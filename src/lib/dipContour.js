// ─────────────────────────────────────────────
// DipContour — DIP 외곽 폭 관찰 (RC1.2.2 P0-9, 경량 MVP)
//
// 목표: 새 segmentation 모델·OpenCV·서버 분석 없이, 이미 촬영하는 spread 포즈 프레임에서
// 끝마디(DIP) 주변 외곽 폭과 좌우 비대칭을 관찰한다.
//
// 방법: ImageData 픽셀을 손가락 축 기준으로 직접 훑는다. ROI 비트맵을 따로 만들지 않고,
// 축에 수직인 주사선(scan line)을 회전 좌표로 샘플링하므로 별도 이미지 버퍼가 필요 없다.
//   1) 손가락 축 = PIP→TIP 방향. 축에 수직인 방향으로 주사선을 긋는다(= 축을 수직 정렬한 것과 동일).
//   2) ROI 가장자리(축에서 먼 지점)들의 중앙값으로 배경색을 추정한다.
//   3) 배경색과의 거리로 이진화한다.
//   4) 주사선에서 "축(중심)과 연결된" 연속 구간만 손가락으로 인정한다(작은 노이즈 자동 배제).
//
// 이 모듈은 관찰값만 만든다 — 진단·붓기 판정·정상범위 판단을 하지 않는다.
// 사진·영상·마스크·윤곽 좌표·raw landmark는 만들지도 반환하지도 않는다(§7).
// ─────────────────────────────────────────────

export const MEASUREMENT_VERSION = "dip-contour-v1";

export const CONTOUR_FLAG = {
  LANDMARK_MISSING: "dip_landmark_missing",
  ROI_OUT_OF_BOUNDS: "dip_roi_out_of_bounds",
  LOW_CONTRAST: "dip_low_background_contrast",
  CONTOUR_BROKEN: "dip_contour_broken",
  FINGER_OVERLAP: "dip_finger_overlap",
  FRAME_VARIATION: "dip_frame_variation_high",
  FRAMES_INSUFFICIENT: "dip_frames_insufficient",
};

/** 한 포즈에서 모으는 프레임 수와, 관찰로 인정할 최소 유효 프레임 수(§1·§5). */
export const CONTOUR_FRAME_TARGET = 12;
export const CONTOUR_FRAME_MIN_COLLECT = 9;
export const MIN_VALID_FRAMES = 7;

// 주사선 길이 — 손가락 폭 대비 충분히 넓게 잡아야 배경까지 닿는다(지골 길이 비율).
const SCAN_HALF_SPAN_RATIO = 0.55;
// 배경 추정에 쓸 "축에서 먼" 구간(주사 반경 대비).
const BACKGROUND_EDGE_FROM = 0.82;
// 배경과 이만큼 떨어져야 손가락 픽셀로 본다(0~255 거리).
const FOREGROUND_DISTANCE = 34;
// 배경/전경 대비가 이보다 낮으면 분리 불가로 본다.
const MIN_CONTRAST = 22;
// 주사선 폭이 반경의 이 비율을 넘으면 옆 손가락과 붙은 것으로 본다.
const OVERLAP_WIDTH_RATIO = 0.92;
// DIP 폭이 인접 지골 몸통의 이 배를 넘으면 손가락이 붙어 한 덩어리로 읽힌 것으로 본다.
// (끝마디가 몸통의 2배를 넘게 관찰되는 경우는 윤곽 분리 실패로 보는 편이 안전하다.)
const MAX_PLAUSIBLE_WIDTH_RATIO = 2.2;
// 프레임 간 변동(MAD/중앙값)이 이보다 크면 불안정으로 본다.
const MAX_RELATIVE_MAD = 0.18;

/** 각 손가락의 PIP/DIP/TIP landmark 인덱스(§2). */
export const DIP_ROI_CHAINS = {
  index:  { pip: 6,  dip: 7,  tip: 8,  name: "검지" },
  middle: { pip: 10, dip: 11, tip: 12, name: "중지" },
  ring:   { pip: 14, dip: 15, tip: 16, name: "약지" },
  pinky:  { pip: 18, dip: 19, tip: 20, name: "소지" },
};

const INDEX_MCP = 5;
const PINKY_MCP = 17;

function px(lm, i, w, h) {
  const p = lm?.[i];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: p.x * w, y: p.y * h };
}

/** ImageData에서 (x,y) 픽셀의 RGB를 읽는다. 범위를 벗어나면 null. */
function sampleRgb(img, x, y) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return null;
  const o = (yi * img.width + xi) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

function rgbDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function median(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 중앙값 절대편차 — 이상치에 흔들리지 않는 변동 지표(§5). */
export function medianAbsoluteDeviation(values) {
  const med = median(values);
  if (med === null) return null;
  return median(values.map((v) => Math.abs(v - med)));
}

/**
 * 주사선 하나를 훑어 "축과 연결된" 손가락 구간의 좌우 반폭을 구한다.
 *
 * @param center  주사선 중심(손가락 축 위의 점)
 * @param perp    축에 수직인 단위 벡터(+ 방향이 radial)
 * @param radius  주사 반경(픽셀)
 * @param bg      배경색 [r,g,b]
 * @returns {{radial:number, ulnar:number, touchedEdge:boolean}|null}
 *          축 위 픽셀이 배경과 구분되지 않으면(윤곽 단절) null.
 */
function scanLine(img, center, perp, radius, bg) {
  const step = 1;
  const at = (t) => sampleRgb(img, center.x + perp.x * t, center.y + perp.y * t);

  const centerRgb = at(0);
  if (!centerRgb || rgbDistance(centerRgb, bg) < FOREGROUND_DISTANCE) return null;

  const walk = (sign) => {
    let last = 0;
    for (let t = step; t <= radius; t += step) {
      const rgb = at(sign * t);
      // 화면 밖으로 나가면 그 자리에서 멈추고 "가장자리에 닿았다"고 본다.
      if (!rgb) return { dist: last, edge: true };
      if (rgbDistance(rgb, bg) < FOREGROUND_DISTANCE) return { dist: t, edge: false };
      last = t;
    }
    return { dist: radius, edge: true }; // 반경 끝까지 손가락 → 옆 손가락과 붙었을 가능성
  };

  const rad = walk(1);
  const uln = walk(-1);
  return { radial: rad.dist, ulnar: uln.dist, touchedEdge: rad.edge || uln.edge };
}

/** ROI 가장자리 픽셀들의 중앙값으로 배경색을 추정한다(§3). */
function estimateBackground(img, stations, perp, radius) {
  const samples = [[], [], []];
  stations.forEach((c) => {
    [1, -1].forEach((sign) => {
      for (let f = BACKGROUND_EDGE_FROM; f <= 1.0; f += 0.06) {
        const rgb = sampleRgb(img, c.x + perp.x * sign * radius * f, c.y + perp.y * sign * radius * f);
        if (rgb) { samples[0].push(rgb[0]); samples[1].push(rgb[1]); samples[2].push(rgb[2]); }
      }
    });
  });
  if (samples[0].length < 4) return null;
  return [median(samples[0]), median(samples[1]), median(samples[2])];
}

/**
 * 한 프레임에서 손가락 하나의 DIP 외곽 폭을 관찰한다.
 *
 * @param imageData  캔버스 ImageData (프레임 전체)
 * @param landmarks  정규화 landmark 배열(0~1)
 * @param chain      DIP_ROI_CHAINS의 한 항목
 * @param radialSign 이미지 좌표에서 +perp가 radial인지(+1) ulnar인지(-1)
 * @returns {{ok:boolean, flags:string[], dipWidthRatio?:number, radialHalfWidthRatio?:number,
 *            ulnarHalfWidthRatio?:number, contourAsymmetryRatio?:number}}
 */
export function measureFingerDipContour(imageData, landmarks, chain, radialSign) {
  const flags = [];
  // RC1.2.2 P0-11 — 실패해도 오버레이가 "어디를 보고 있는지"는 그려야 하므로,
  // 가능한 만큼의 표시용 geometry를 함께 돌려준다(저장 payload에는 들어가지 않는다).
  const fail = (flag, displayGeometry = null) => ({ ok: false, flags: [flag], displayGeometry });

  const w = imageData?.width ?? 0;
  const h = imageData?.height ?? 0;
  if (!w || !h) return fail(CONTOUR_FLAG.LANDMARK_MISSING);

  const pip = px(landmarks, chain.pip, w, h);
  const dip = px(landmarks, chain.dip, w, h);
  const tip = px(landmarks, chain.tip, w, h);
  if (!pip || !dip || !tip) return fail(CONTOUR_FLAG.LANDMARK_MISSING);

  // 손가락 축 = PIP→TIP. 축에 수직인 방향으로 주사 = 축을 수직 정렬한 것과 동등(§2).
  const ax = tip.x - pip.x;
  const ay = tip.y - pip.y;
  const axisLen = Math.hypot(ax, ay);
  if (!(axisLen > 4)) return fail(CONTOUR_FLAG.LANDMARK_MISSING);
  const axis = { x: ax / axisLen, y: ay / axisLen };
  // 수직 벡터. radialSign으로 +방향이 항상 엄지쪽이 되게 맞춘다(좌우 손 정규화).
  const perp = { x: -axis.y * radialSign, y: axis.x * radialSign };

  const radius = Math.max(6, axisLen * SCAN_HALF_SPAN_RATIO);

  // 표시용 중심축(짧게) — DIP를 중심으로 PIP↔TIP 방향 일부만 그린다.
  const axisHalf = axisLen * 0.18;
  const axisGeometry = {
    dipCenter: { x: dip.x, y: dip.y },
    axisStart: { x: dip.x - axis.x * axisHalf, y: dip.y - axis.y * axisHalf },
    axisEnd: { x: dip.x + axis.x * axisHalf, y: dip.y + axis.y * axisHalf },
    radialEdge: null,
    ulnarEdge: null,
  };

  // DIP 주변 주사 위치와, 비교 기준이 되는 인접 지골(중위지골) 몸통 주사 위치.
  const along = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  const dipStations = [-0.12, -0.06, 0, 0.06, 0.12].map((t) => ({
    x: dip.x + axis.x * t * axisLen,
    y: dip.y + axis.y * t * axisLen,
  }));
  const bodyStations = [0.35, 0.45, 0.55, 0.65].map((t) => along(pip, dip, t));

  // ROI가 화면 밖으로 크게 벗어나면 관찰하지 않는다(§6 ROI 잘림).
  const outOfBounds = [...dipStations, ...bodyStations].some(
    (c) => c.x < 0 || c.y < 0 || c.x >= w || c.y >= h
  );
  if (outOfBounds) return fail(CONTOUR_FLAG.ROI_OUT_OF_BOUNDS, axisGeometry);

  const bg = estimateBackground(imageData, [...dipStations, ...bodyStations], perp, radius);
  if (!bg) return fail(CONTOUR_FLAG.LOW_CONTRAST, axisGeometry);

  // 축 위 픽셀(=손가락)과 배경의 대비가 충분한지 확인(§6 배경 대비 부족).
  const axisSamples = dipStations
    .map((c) => sampleRgb(imageData, c.x, c.y))
    .filter(Boolean)
    .map((rgb) => rgbDistance(rgb, bg));
  const contrast = median(axisSamples);
  if (contrast === null || contrast < MIN_CONTRAST) return fail(CONTOUR_FLAG.LOW_CONTRAST, axisGeometry);

  const runFor = (stations) => stations.map((c) => scanLine(imageData, c, perp, radius, bg));
  const dipRuns = runFor(dipStations);
  const bodyRuns = runFor(bodyStations);

  // 윤곽이 끊겨 중심 구간을 못 찾으면 실패(§6 윤곽 단절).
  const dipValid = dipRuns.filter(Boolean);
  const bodyValid = bodyRuns.filter(Boolean);
  if (dipValid.length < 3 || bodyValid.length < 2) return fail(CONTOUR_FLAG.CONTOUR_BROKEN, axisGeometry);

  // 반경 끝까지 손가락이면 옆 손가락과 붙은 것으로 본다(§6 손가락 겹침).
  if (dipValid.filter((r) => r.touchedEdge).length > dipValid.length / 2) {
    return fail(CONTOUR_FLAG.FINGER_OVERLAP, axisGeometry);
  }

  const dipRadial = median(dipValid.map((r) => r.radial));
  const dipUlnar = median(dipValid.map((r) => r.ulnar));
  const dipWidth = dipRadial + dipUlnar;
  const bodyWidth = median(bodyValid.map((r) => r.radial + r.ulnar));

  if (!(bodyWidth > 0) || !(dipWidth > 0)) return fail(CONTOUR_FLAG.CONTOUR_BROKEN, axisGeometry);
  if (dipWidth >= radius * 2 * OVERLAP_WIDTH_RATIO) return fail(CONTOUR_FLAG.FINGER_OVERLAP, axisGeometry);
  if (dipWidth / bodyWidth > MAX_PLAUSIBLE_WIDTH_RATIO) return fail(CONTOUR_FLAG.FINGER_OVERLAP, axisGeometry);

  return {
    ok: true,
    flags,
    // §4 — 모두 인접 지골 몸통 폭 대비 비율이라 거리·해상도에 영향받지 않는다.
    dipWidthRatio: dipWidth / bodyWidth,
    radialHalfWidthRatio: dipRadial / bodyWidth,
    ulnarHalfWidthRatio: dipUlnar / bodyWidth,
    // 좌우 비대칭: + = 엄지쪽이 넓음, - = 새끼쪽이 넓음.
    contourAsymmetryRatio: (dipRadial - dipUlnar) / dipWidth,
    // RC1.2.2 P0-11 — 화면에 캘리퍼를 그리기 위한 임시 좌표. 프레임 렌더 직후 폐기하며
    // buildDipContourPayload가 절대 담지 않는다(윤곽 path나 mask도 만들지 않는다).
    displayGeometry: {
      ...axisGeometry,
      radialEdge: { x: dip.x + perp.x * dipRadial, y: dip.y + perp.y * dipRadial },
      ulnarEdge: { x: dip.x - perp.x * dipUlnar, y: dip.y - perp.y * dipUlnar },
    },
  };
}

/**
 * 이미지 좌표계에서 +perp가 radial(엄지쪽)인지 판정한다.
 * 손 좌우·미러링과 무관하게 "소지 MCP → 검지 MCP"가 항상 radial이라는 성질을 쓴다.
 * @returns {number} +1 또는 -1. 판정 불가면 +1.
 */
export function resolveRadialSign(landmarks, width, height, chain) {
  const idxMcp = px(landmarks, INDEX_MCP, width, height);
  const pinkyMcp = px(landmarks, PINKY_MCP, width, height);
  const pip = px(landmarks, chain.pip, width, height);
  const tip = px(landmarks, chain.tip, width, height);
  if (!idxMcp || !pinkyMcp || !pip || !tip) return 1;

  const ax = tip.x - pip.x;
  const ay = tip.y - pip.y;
  const len = Math.hypot(ax, ay) || 1;
  const perp = { x: -ay / len, y: ax / len };
  const radialVec = { x: idxMcp.x - pinkyMcp.x, y: idxMcp.y - pinkyMcp.y };
  return perp.x * radialVec.x + perp.y * radialVec.y >= 0 ? 1 : -1;
}

/** 한 프레임에서 네 손가락 전부를 관찰한다. */
export function measureFrameDipContours(imageData, landmarks) {
  return Object.entries(DIP_ROI_CHAINS).map(([key, chain]) => {
    const sign = resolveRadialSign(landmarks, imageData?.width ?? 0, imageData?.height ?? 0, chain);
    return { key, name: chain.name, ...measureFingerDipContour(imageData, landmarks, chain, sign) };
  });
}

/**
 * 여러 프레임의 관찰을 손가락별 중앙값으로 집계하고 안정성을 판정한다(§5·§6).
 * 실패한 손가락은 0을 채우지 않고 ok:false로 남긴다(§6 "실패 시 0 저장 금지").
 */
export function aggregateDipContourFrames(frameResults) {
  if (!frameResults?.length) {
    return { ok: false, flags: [CONTOUR_FLAG.FRAMES_INSUFFICIENT], fingers: [] };
  }

  const keys = Object.keys(DIP_ROI_CHAINS);
  const allFlags = new Set();

  const fingers = keys.map((key) => {
    const name = DIP_ROI_CHAINS[key].name;
    const perFrame = frameResults
      .map((frame) => frame?.find((f) => f.key === key))
      .filter(Boolean);
    perFrame.forEach((r) => (r.flags ?? []).forEach((f) => allFlags.add(f)));

    const valid = perFrame.filter((r) => r.ok);
    if (valid.length < MIN_VALID_FRAMES) {
      allFlags.add(CONTOUR_FLAG.FRAMES_INSUFFICIENT);
      return { key, name, ok: false, validFrames: valid.length, flags: [CONTOUR_FLAG.FRAMES_INSUFFICIENT] };
    }

    const widths = valid.map((r) => r.dipWidthRatio);
    const dipWidthRatio = median(widths);
    const mad = medianAbsoluteDeviation(widths);
    const relativeMad = dipWidthRatio > 0 ? mad / dipWidthRatio : Infinity;

    if (!(relativeMad <= MAX_RELATIVE_MAD)) {
      allFlags.add(CONTOUR_FLAG.FRAME_VARIATION);
      return {
        key, name, ok: false, validFrames: valid.length,
        stabilityMad: round3(mad), relativeVariation: round3(relativeMad),
        flags: [CONTOUR_FLAG.FRAME_VARIATION],
      };
    }

    return {
      key, name, ok: true,
      dipWidthRatio: round3(dipWidthRatio),
      radialHalfWidthRatio: round3(median(valid.map((r) => r.radialHalfWidthRatio))),
      ulnarHalfWidthRatio: round3(median(valid.map((r) => r.ulnarHalfWidthRatio))),
      contourAsymmetryRatio: round3(median(valid.map((r) => r.contourAsymmetryRatio))),
      validFrames: valid.length,
      stabilityMad: round3(mad),
      relativeVariation: round3(relativeMad),
      flags: [],
    };
  });

  const observed = fingers.filter((f) => f.ok);
  return {
    // 손가락이 하나도 관찰되지 않으면 관찰 실패 — 재측정 대상(§6).
    ok: observed.length > 0,
    fingers,
    flags: [...allFlags],
    measurementVersion: MEASUREMENT_VERSION,
  };
}

function round3(v) {
  return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
}

/**
 * 저장용 payload를 만든다(§7).
 * 사진·영상·마스크·윤곽 좌표·raw landmark는 담지 않는다 — 파생 비율과 품질값만 담는다.
 * 실패한 손가락은 값 없이 제외한다(0으로 채우지 않는다).
 */
export function buildDipContourPayload(aggregate) {
  if (!aggregate?.ok) return null;
  return {
    measurementVersion: MEASUREMENT_VERSION,
    fingers: aggregate.fingers
      .filter((f) => f.ok)
      .map((f) => ({
        key: f.key,
        name: f.name,
        dipWidthRatio: f.dipWidthRatio,
        radialHalfWidthRatio: f.radialHalfWidthRatio,
        ulnarHalfWidthRatio: f.ulnarHalfWidthRatio,
        contourAsymmetryRatio: f.contourAsymmetryRatio,
        validFrames: f.validFrames,
        stabilityMad: f.stabilityMad,
      })),
    qualityFlags: aggregate.flags,
  };
}

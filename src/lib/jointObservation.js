// ─────────────────────────────────────────────
// JointObservation — DIP 중심 끝마디 관찰 모델 (RC1.2.2 P0-8)
//
// 관찰 우선순위: 1) DIP 끝마디  2) PIP 중간마디  3) 손가락 전체 활동 가동범위
//
// 이 모듈은 landmark(순수 좌표)만 받아 관절별 굴곡/편위 각도를 계산한다. 카메라·MediaPipe·
// React를 모른다. 원본 좌표는 각도 계산에만 쓰고 저장하지 않는다(§9).
//
// 진단·정상범위·악화 판정은 이 모듈의 책임이 아니다 — 관찰값만 만든다.
// ─────────────────────────────────────────────

export const WRIST = 0;

/** 각 손가락의 landmark 인덱스 체인. tip까지 포함해야 DIP 굴곡을 계산할 수 있다. */
export const FINGER_CHAINS = {
  index:  { mcp: 5,  pip: 6,  dip: 7,  tip: 8,  name: "검지" },
  middle: { mcp: 9,  pip: 10, dip: 11, tip: 12, name: "중지" },
  ring:   { mcp: 13, pip: 14, dip: 15, tip: 16, name: "약지" },
  pinky:  { mcp: 17, pip: 18, dip: 19, tip: 20, name: "소지" },
};

export const INDEX_MCP = 5;
export const PINKY_MCP = 17;

/** 편위 방향 — 엄지쪽이 radial, 소지쪽이 ulnar. 손 좌우와 무관하게 해부학적으로 고정된다. */
export const DEVIATION_DIRECTION = {
  RADIAL: "radial",
  ULNAR: "ulnar",
  NEUTRAL: "neutral",
};

// 편위 방향을 "없음"으로 볼 각도 — 이보다 작으면 좌우 어느 쪽이라 말하지 않는다.
const NEUTRAL_DEVIATION_DEG = 1.5;

// ── 벡터 유틸 ──
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function len(v) { return Math.sqrt(dot(v, v)); }
function scale(v, k) { return { x: v.x * k, y: v.y * k, z: v.z * k }; }
function isFinitePoint(p) {
  return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

// 좌표 단위(정규화 좌표 ~0..1, world 좌표 m)에 따라 크기가 달라지므로, 길이 판정은
// 손 크기 대비 비율로 한다. 절대 임계값을 쓰면 단위가 바뀌는 순간 전부 실패한다.
const MIN_SEGMENT_RATIO = 0.02;

/**
 * 손바닥 로컬 좌표계를 만든다.
 *   palmNormal : 손바닥 평면의 법선 (wrist, index MCP, pinky MCP 세 점)
 *   radialAxis : 소지 MCP → 검지 MCP 방향 = 해부학적 radial(엄지쪽)
 *
 * radialAxis를 좌표축의 외적이 아니라 "실제 손가락 위치 차이"로 정의하는 것이 핵심이다.
 * 외적으로 만든 축은 왼손/오른손에서 부호가 뒤집히고 미러링에도 흔들리지만, 이 방식은
 * 좌우 손 모두에서 항상 엄지쪽을 가리킨다.
 * @returns {{palmNormal: object, radialAxis: object, handScale: number}|null}
 */
export function buildPalmFrame(lm) {
  if (!lm) return null;
  const wrist = lm[WRIST];
  const idxMcp = lm[INDEX_MCP];
  const pinkyMcp = lm[PINKY_MCP];
  if (!isFinitePoint(wrist) || !isFinitePoint(idxMcp) || !isFinitePoint(pinkyMcp)) return null;

  const toIndex = sub(idxMcp, wrist);
  const toPinky = sub(pinkyMcp, wrist);
  const handScale = len(sub(idxMcp, wrist));
  if (!(handScale > 0)) return null;

  const normalRaw = cross(toIndex, toPinky);
  const nLen = len(normalRaw);
  // 세 점이 거의 일직선이면 평면을 정의할 수 없다 — 손이 정면을 향하지 않는 프레임.
  if (nLen < 1e-9) return null;

  const radialRaw = sub(idxMcp, pinkyMcp); // 소지 → 검지 = radial
  const rLen = len(radialRaw);
  if (rLen < 1e-9) return null;

  return {
    palmNormal: scale(normalRaw, 1 / nLen),
    radialAxis: scale(radialRaw, 1 / rLen),
    handScale,
  };
}

/**
 * 관절 하나(proximal-joint-distal)의 굴곡각과 좌우 편위각을 로컬 좌표계에서 분리 계산한다.
 *
 *   e1 = 근위 분절 방향(관절이 펴진 방향)
 *   e2 = 손바닥 법선에서 e1 성분을 뺀 방향 → 굴곡 평면
 *   e3 = radial 축에서 e1 성분을 뺀 방향 → 좌우 편위 평면(엄지쪽이 +)
 *
 * flexion  : 0°가 완전 신전. 굽을수록 커진다. 음수는 나오지 않는다(과신전은 0으로 본다).
 * deviation: 부호 있는 값. + = radial(엄지쪽), - = ulnar(소지쪽).
 *
 * @returns {{flexionDeg:number, deviationDeg:number, direction:string, valid:boolean, reason?:string}}
 */
export function analyzeJoint(lm, proximalIdx, jointIdx, distalIdx, palmFrame) {
  const invalid = (reason) => ({
    flexionDeg: null, deviationDeg: null, direction: null, valid: false, reason,
  });

  const p = lm?.[proximalIdx];
  const j = lm?.[jointIdx];
  const d = lm?.[distalIdx];
  if (!isFinitePoint(p) || !isFinitePoint(j) || !isFinitePoint(d)) return invalid("landmark_missing");
  if (!palmFrame) return invalid("palm_frame_unavailable");

  const proximal = sub(j, p);
  const distal = sub(d, j);
  const pLen = len(proximal);
  const dLen = len(distal);
  // §7 — 관절 벡터 길이가 손 크기 대비 지나치게 짧으면(가림·추정 실패) 각도를 신뢰하지 않는다.
  const minLen = palmFrame.handScale * MIN_SEGMENT_RATIO;
  if (!(pLen > minLen) || !(dLen > minLen)) return invalid("segment_too_short");

  const e1 = scale(proximal, 1 / pLen);

  // 손바닥 법선에서 e1 성분 제거 → 굴곡 평면의 축
  const nAlong = dot(palmFrame.palmNormal, e1);
  const e2raw = sub(palmFrame.palmNormal, scale(e1, nAlong));
  const e2len = len(e2raw);
  if (e2len < 1e-9) return invalid("degenerate_frame");
  const e2 = scale(e2raw, 1 / e2len);

  // radial 축에서 e1 성분 제거 → 좌우 편위 평면의 축(엄지쪽 +)
  const rAlong = dot(palmFrame.radialAxis, e1);
  const e3raw = sub(palmFrame.radialAxis, scale(e1, rAlong));
  const e3len = len(e3raw);
  if (e3len < 1e-9) return invalid("degenerate_frame");
  const e3 = scale(e3raw, 1 / e3len);

  const fx = dot(distal, e1); // 뻗은 방향 성분
  const fy = dot(distal, e2); // 굽힘 성분
  const fz = dot(distal, e3); // 좌우 편위 성분(+ = radial)

  // 굴곡은 손바닥 쪽으로 굽는 것만 센다. palmNormal의 부호는 손 좌우에 따라 뒤집히므로
  // 절대값을 쓰고, 신전 방향(과신전)은 0으로 눌러 "최대 신전 제한"을 실패로 만들지 않는다(§4).
  const flexionDeg = Math.atan2(Math.abs(fy), fx) * (180 / Math.PI);
  const deviationDeg = Math.atan2(fz, fx) * (180 / Math.PI);

  if (!Number.isFinite(flexionDeg) || !Number.isFinite(deviationDeg)) return invalid("non_finite");

  return {
    flexionDeg: Math.max(0, flexionDeg),
    deviationDeg,
    direction: deviationDirectionOf(deviationDeg),
    valid: true,
  };
}

/** 부호 있는 편위각 → 방향 라벨. 아주 작은 값은 방향을 단정하지 않는다. */
export function deviationDirectionOf(deviationDeg) {
  if (!Number.isFinite(deviationDeg)) return null;
  if (Math.abs(deviationDeg) < NEUTRAL_DEVIATION_DEG) return DEVIATION_DIRECTION.NEUTRAL;
  return deviationDeg > 0 ? DEVIATION_DIRECTION.RADIAL : DEVIATION_DIRECTION.ULNAR;
}

/**
 * 한 프레임의 landmark로 4손가락의 PIP·DIP 관절을 모두 분석한다.
 * @returns {Array<{key,name,pip,dip}>|null}
 */
export function analyzeFingerJoints(lm) {
  const palmFrame = buildPalmFrame(lm);
  return Object.entries(FINGER_CHAINS).map(([key, c]) => ({
    key,
    name: c.name,
    // PIP 굴곡: MCP-PIP-DIP
    pip: analyzeJoint(lm, c.mcp, c.pip, c.dip, palmFrame),
    // DIP 굴곡: PIP-DIP-TIP
    dip: analyzeJoint(lm, c.pip, c.dip, c.tip, palmFrame),
  }));
}

// ── 집계 ──

function median(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdDev(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length);
}

/**
 * 여러 프레임의 analyzeFingerJoints() 결과를 손가락·관절별 중앙값으로 집계한다.
 * 프레임 분산(§7 안정성 판정 재료)도 함께 돌려준다.
 */
export function aggregateJointSamples(frames) {
  if (!frames?.length) return null;
  const first = frames[0];
  if (!first?.length) return null;

  return first.map((finger, idx) => {
    const build = (joint) => {
      const valid = frames.map((f) => f[idx]?.[joint]).filter((r) => r?.valid);
      const flexions = valid.map((r) => r.flexionDeg);
      const deviations = valid.map((r) => r.deviationDeg);
      const flexionDeg = median(flexions);
      const deviationDeg = median(deviations);
      return {
        flexionDeg,
        deviationDeg,
        direction: deviationDirectionOf(deviationDeg),
        validFrames: valid.length,
        totalFrames: frames.length,
        flexionSpreadDeg: stdDev(flexions),
        deviationSpreadDeg: stdDev(deviations),
        valid: valid.length > 0 && Number.isFinite(flexionDeg),
      };
    };
    return { key: finger.key, name: finger.name, pip: build("pip"), dip: build("dip") };
  });
}

// ── 포즈별 관찰값 → 손가락별 관절 관찰 레코드 ──

function round1(v) { return Number.isFinite(v) ? Math.round(v * 10) / 10 : null; }

/**
 * 최대 신전 포즈와 최대 굴곡 포즈의 집계 결과를 합쳐 저장용 관찰 레코드를 만든다.
 *
 * §4 최대 신전 제한 인정: 다 폈는데도 굴곡이 남아 있으면 그 값을 그대로 기록한다.
 * 잔여 굴곡은 관찰 대상이지 실패가 아니다.
 * §6 활동 가동범위 = 최대 굴곡 - 최대 신전(음수면 0).
 */
export function buildFingerJointObservations(extensionAgg, flexionAgg) {
  if (!extensionAgg || !flexionAgg) return [];

  return extensionAgg.map((ext, idx) => {
    const flex = flexionAgg[idx];
    // RC1.2.2 P0-10 — 굴곡 포즈에서 얻은 값이 신전 포즈보다 크지 않으면 가동범위를 관찰한
    // 것이 아니다(주먹을 쥐면 끝마디가 손바닥에 가려져 tip 추정이 무너지는 경우가 실제로
    // 있다). 이때 0°를 값처럼 보여주면 "움직이지 않는다"로 오해되므로 null로 남기고
    // 화면에서는 "관찰 어려움"으로 표시한다. 아주 작지만 실제로 관찰된 범위는 그대로 쓴다.
    const romOf = (maxFlex, extFlex) => {
      if (!Number.isFinite(maxFlex) || !Number.isFinite(extFlex)) return null;
      const diff = maxFlex - extFlex;
      return diff > 0 ? diff : null;
    };

    return {
      key: ext.key,
      name: ext.name,

      // 1순위 — DIP 끝마디
      dipExtensionPoseFlexionDeg: round1(ext.dip.flexionDeg),
      dipExtensionPoseDeviationDeg: round1(ext.dip.deviationDeg),
      dipDeviationDirection: ext.dip.direction,
      dipMaxFlexionDeg: round1(flex.dip.flexionDeg),
      dipActiveRomDeg: round1(romOf(flex.dip.flexionDeg, ext.dip.flexionDeg)),

      // 2순위 — PIP 중간마디
      pipExtensionPoseFlexionDeg: round1(ext.pip.flexionDeg),
      pipExtensionPoseDeviationDeg: round1(ext.pip.deviationDeg),
      pipDeviationDirection: ext.pip.direction,
      pipMaxFlexionDeg: round1(flex.pip.flexionDeg),
      pipActiveRomDeg: round1(romOf(flex.pip.flexionDeg, ext.pip.flexionDeg)),

      // 관찰 신뢰도 재료(각도 크기와 무관한 품질값만)
      dipObserved: ext.dip.valid && flex.dip.valid,
      pipObserved: ext.pip.valid && flex.pip.valid,
    };
  });
}

/**
 * 대표 편위 방향 — 손가락별 DIP 편위 방향 중 다수. 표시·비교에 쓰는 요약값이다.
 * 진단이 아니라 "어느 쪽으로 치우쳐 관찰됐는가"의 기술이다.
 */
export function summarizeDeviationDirection(observations) {
  const counts = observations.reduce((acc, o) => {
    const d = o.dipDeviationDirection;
    if (d && d !== DEVIATION_DIRECTION.NEUTRAL) acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts);
  if (!entries.length) return DEVIATION_DIRECTION.NEUTRAL;
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return DEVIATION_DIRECTION.NEUTRAL;
  return entries[0][0];
}

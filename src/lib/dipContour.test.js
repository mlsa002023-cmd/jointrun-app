// dipContour — DIP 외곽 폭 관찰 (RC1.2.2 P0-9)
//
// 합성 ImageData로 검증한다. 실제 카메라 대신 "축을 따라 폭이 정해진 막대"를 그려서,
// 알고리즘이 DIP 주변 폭과 좌우 반폭을 의도대로 읽는지 확인한다.
import { describe, it, expect } from "vitest";
import {
  DIP_ROI_CHAINS,
  CONTOUR_FLAG,
  MEASUREMENT_VERSION,
  measureFingerDipContour,
  measureFrameDipContours,
  aggregateDipContourFrames,
  buildDipContourPayload,
  resolveRadialSign,
  medianAbsoluteDeviation,
} from "./dipContour";

const W = 240;
const H = 320;

/** 테스트용 ImageData(브라우저 없이 동작하는 순수 객체). */
function blankImage(bg = [30, 30, 30], w = W, h = H) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

function setPx(img, x, y, rgb) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return;
  const o = (yi * img.width + xi) * 4;
  img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
}

/**
 * 손가락 하나를 그리고 그에 맞는 landmark를 만든다.
 *
 * 축은 pip → tip. dip는 축의 60% 지점.
 * 폭 프로파일: 몸통 구간(t 0.15~0.42)은 bodyHalf, DIP 구간(t 0.46~0.76)은 dipRadial/dipUlnar.
 * angleDeg로 손 전체를 회전시키고, scale로 거리(크기)를 바꾼다.
 */
function makeFingerFrame({
  bodyHalf = 9,
  dipRadial = 9,
  dipUlnar = 9,
  bg = [30, 30, 30],
  fg = [210, 170, 150],
  angleDeg = 0,
  scale = 1,
  mirrored = false,
  axisLen = 140,
  centerX = W / 2,
  centerY = H / 2,
  drawFinger = true,
} = {}) {
  const img = blankImage(bg);
  const rad = (angleDeg * Math.PI) / 180;
  const L = axisLen * scale;
  // 축 방향(회전 적용). 기본은 위쪽(-y).
  const axis = { x: Math.sin(rad), y: -Math.cos(rad) };
  const perpRaw = { x: -axis.y, y: axis.x }; // +방향
  const sideSign = mirrored ? -1 : 1;        // radial이 놓이는 쪽

  const pip = { x: centerX - (axis.x * L) / 2, y: centerY - (axis.y * L) / 2 };
  const tip = { x: pip.x + axis.x * L, y: pip.y + axis.y * L };
  const dip = { x: pip.x + axis.x * L * 0.6, y: pip.y + axis.y * L * 0.6 };

  const halfAt = (t) => {
    if (t >= 0.46 && t <= 0.76) return { r: dipRadial * scale, u: dipUlnar * scale };
    if (t >= 0.1 && t <= 0.44) return { r: bodyHalf * scale, u: bodyHalf * scale };
    return { r: bodyHalf * scale, u: bodyHalf * scale };
  };

  if (drawFinger) {
    const steps = Math.ceil(L * 3);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const cx = pip.x + axis.x * L * t;
      const cy = pip.y + axis.y * L * t;
      const { r, u } = halfAt(t);
      // radial 쪽(+sideSign) 과 ulnar 쪽(-sideSign)을 각각 채운다.
      for (let d = 0; d <= r; d += 0.5) {
        setPx(img, cx + perpRaw.x * sideSign * d, cy + perpRaw.y * sideSign * d, fg);
      }
      for (let d = 0; d <= u; d += 0.5) {
        setPx(img, cx - perpRaw.x * sideSign * d, cy - perpRaw.y * sideSign * d, fg);
      }
    }
  }

  // landmark(정규화). index MCP는 radial 쪽, pinky MCP는 ulnar 쪽에 둔다.
  const lm = [];
  const put = (i, p) => { lm[i] = { x: p.x / W, y: p.y / H }; };
  put(0, { x: centerX, y: centerY + L });
  put(5, { x: centerX + perpRaw.x * sideSign * 40, y: centerY + perpRaw.y * sideSign * 40 });
  put(17, { x: centerX - perpRaw.x * sideSign * 40, y: centerY - perpRaw.y * sideSign * 40 });
  const chain = DIP_ROI_CHAINS.index;
  put(chain.pip, pip);
  put(chain.dip, dip);
  put(chain.tip, tip);
  // 나머지 손가락도 같은 자리에 둔다(프레임 단위 함수 테스트용).
  Object.values(DIP_ROI_CHAINS).forEach((c) => {
    if (!lm[c.pip]) { put(c.pip, pip); put(c.dip, dip); put(c.tip, tip); }
  });

  return { img, lm, chain };
}

/** 단일 손가락 관찰을 바로 수행한다. */
function measureOne(opts = {}) {
  const { img, lm, chain } = makeFingerFrame(opts);
  const sign = resolveRadialSign(lm, img.width, img.height, chain);
  return measureFingerDipContour(img, lm, chain, sign);
}

/** 같은 조건으로 n프레임(미세 노이즈 포함) 만들어 집계한다. */
function aggregateOf(opts = {}, n = 10) {
  const frames = Array.from({ length: n }, (_, i) => {
    const { img, lm } = makeFingerFrame({ ...opts, centerX: W / 2 + (i % 2 ? 0.4 : -0.4) });
    return measureFrameDipContours(img, lm);
  });
  return aggregateDipContourFrames(frames);
}

describe("DIP ROI 체인 (§2)", () => {
  it("네 손가락의 PIP/DIP/TIP 인덱스가 규격과 같다", () => {
    expect(DIP_ROI_CHAINS.index).toMatchObject({ pip: 6, dip: 7, tip: 8 });
    expect(DIP_ROI_CHAINS.middle).toMatchObject({ pip: 10, dip: 11, tip: 12 });
    expect(DIP_ROI_CHAINS.ring).toMatchObject({ pip: 14, dip: 15, tip: 16 });
    expect(DIP_ROI_CHAINS.pinky).toMatchObject({ pip: 18, dip: 19, tip: 20 });
  });
});

describe("기본 폭 계산 (§4)", () => {
  it("DIP와 몸통 폭이 같으면 폭 비율이 1 부근이다", () => {
    const r = measureOne({ bodyHalf: 9, dipRadial: 9, dipUlnar: 9 });
    expect(r.ok).toBe(true);
    expect(r.dipWidthRatio).toBeGreaterThan(0.85);
    expect(r.dipWidthRatio).toBeLessThan(1.15);
  });

  it("DIP가 몸통보다 넓으면 폭 비율이 1보다 크다", () => {
    const r = measureOne({ bodyHalf: 8, dipRadial: 13, dipUlnar: 13 });
    expect(r.ok).toBe(true);
    expect(r.dipWidthRatio).toBeGreaterThan(1.3);
  });

  it("좌우 반폭을 각각 관찰한다", () => {
    const r = measureOne({ bodyHalf: 9, dipRadial: 14, dipUlnar: 7 });
    expect(r.ok).toBe(true);
    expect(r.radialHalfWidthRatio).toBeGreaterThan(r.ulnarHalfWidthRatio);
  });
});

describe("좌우 비대칭 (§4)", () => {
  it("엄지쪽이 넓으면 비대칭이 양수다", () => {
    const r = measureOne({ bodyHalf: 9, dipRadial: 15, dipUlnar: 7 });
    expect(r.contourAsymmetryRatio).toBeGreaterThan(0.15);
  });

  it("새끼쪽이 넓으면 비대칭이 음수다", () => {
    const r = measureOne({ bodyHalf: 9, dipRadial: 7, dipUlnar: 15 });
    expect(r.contourAsymmetryRatio).toBeLessThan(-0.15);
  });

  it("좌우가 같으면 비대칭이 0 부근이다", () => {
    const r = measureOne({ bodyHalf: 9, dipRadial: 10, dipUlnar: 10 });
    expect(Math.abs(r.contourAsymmetryRatio)).toBeLessThan(0.1);
  });

  it("미러링된 손에서도 같은 해부학적 방향으로 관찰된다", () => {
    const normal = measureOne({ dipRadial: 15, dipUlnar: 7, mirrored: false });
    const mirrored = measureOne({ dipRadial: 15, dipUlnar: 7, mirrored: true });
    expect(normal.contourAsymmetryRatio).toBeGreaterThan(0.15);
    expect(mirrored.contourAsymmetryRatio).toBeGreaterThan(0.15);
  });
});

describe("촬영 조건 변화 (§9)", () => {
  it("배경 밝기가 달라져도 폭 비율이 유지된다", () => {
    const dark = measureOne({ bg: [20, 20, 20], dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    const light = measureOne({ bg: [235, 235, 235], dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    expect(dark.ok && light.ok).toBe(true);
    expect(Math.abs(dark.dipWidthRatio - light.dipWidthRatio)).toBeLessThan(0.15);
  });

  it("손 거리(크기)가 달라져도 폭 비율이 유지된다", () => {
    const near = measureOne({ scale: 1.3, dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    const far = measureOne({ scale: 0.75, dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    expect(near.ok && far.ok).toBe(true);
    expect(Math.abs(near.dipWidthRatio - far.dipWidthRatio)).toBeLessThan(0.2);
  });

  it("손이 회전해도 폭 비율이 유지된다(축 수직 정렬)", () => {
    const straight = measureOne({ angleDeg: 0, dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    const tilted = measureOne({ angleDeg: 28, dipRadial: 13, dipUlnar: 13, bodyHalf: 9 });
    expect(straight.ok && tilted.ok).toBe(true);
    expect(Math.abs(straight.dipWidthRatio - tilted.dipWidthRatio)).toBeLessThan(0.2);
  });
});

describe("실패 조건 — 0을 저장하지 않는다 (§6)", () => {
  it("DIP/TIP landmark가 없으면 실패로 표시한다", () => {
    const { img, lm, chain } = makeFingerFrame();
    lm[chain.tip] = undefined;
    const r = measureFingerDipContour(img, lm, chain, 1);
    expect(r.ok).toBe(false);
    expect(r.flags).toContain(CONTOUR_FLAG.LANDMARK_MISSING);
    expect(r.dipWidthRatio).toBeUndefined(); // 0으로 채우지 않는다
  });

  it("배경 대비가 부족하면 실패로 표시한다", () => {
    const r = measureOne({ bg: [200, 200, 200], fg: [204, 203, 202] });
    expect(r.ok).toBe(false);
    expect(r.flags).toContain(CONTOUR_FLAG.LOW_CONTRAST);
  });

  it("윤곽이 없으면(손가락 미검출) 실패로 표시한다", () => {
    const r = measureOne({ drawFinger: false });
    expect(r.ok).toBe(false);
    expect([CONTOUR_FLAG.LOW_CONTRAST, CONTOUR_FLAG.CONTOUR_BROKEN]).toContain(r.flags[0]);
  });

  it("ROI가 화면 밖으로 나가면 실패로 표시한다", () => {
    const r = measureOne({ centerY: 6, axisLen: 200 });
    expect(r.ok).toBe(false);
    expect(r.flags).toContain(CONTOUR_FLAG.ROI_OUT_OF_BOUNDS);
  });

  it("옆 손가락과 붙어 한 덩어리로 읽히면 실패로 표시한다", () => {
    // 몸통은 정상 폭인데 DIP 구간만 옆 손가락과 붙어 폭이 비정상적으로 커진 상황.
    // (배경은 더 바깥에 존재하므로 대비 문제는 아니고, 윤곽 분리 실패다.)
    const r = measureOne({ bodyHalf: 8, dipRadial: 30, dipUlnar: 28 });
    expect(r.ok).toBe(false);
    expect(r.flags).toContain(CONTOUR_FLAG.FINGER_OVERLAP);
  });
});

describe("다중 프레임 집계 (§5)", () => {
  it("유효 프레임이 7개 미만이면 관찰로 인정하지 않는다", () => {
    const agg = aggregateOf({ dipRadial: 12, dipUlnar: 12 }, 5);
    expect(agg.fingers.every((f) => !f.ok)).toBe(true);
    expect(agg.flags).toContain(CONTOUR_FLAG.FRAMES_INSUFFICIENT);
  });

  it("유효 프레임이 충분하면 중앙값과 안정성 값을 남긴다", () => {
    const agg = aggregateOf({ bodyHalf: 9, dipRadial: 13, dipUlnar: 13 }, 10);
    const f = agg.fingers.find((x) => x.key === "index");
    expect(f.ok).toBe(true);
    expect(f.validFrames).toBeGreaterThanOrEqual(7);
    expect(Number.isFinite(f.stabilityMad)).toBe(true);
    expect(f.dipWidthRatio).toBeGreaterThan(1.2);
  });

  it("프레임 변동이 과다하면 unreliable로 남기고 값을 채우지 않는다", () => {
    // 프레임마다 폭이 크게 달라지는 상황
    const frames = Array.from({ length: 10 }, (_, i) => {
      const wide = i % 2 === 0;
      const { img, lm } = makeFingerFrame({ bodyHalf: 9, dipRadial: wide ? 20 : 6, dipUlnar: wide ? 20 : 6 });
      return measureFrameDipContours(img, lm);
    });
    const agg = aggregateDipContourFrames(frames);
    const f = agg.fingers.find((x) => x.key === "index");
    expect(f.ok).toBe(false);
    expect(f.flags).toContain(CONTOUR_FLAG.FRAME_VARIATION);
    expect(f.dipWidthRatio).toBeUndefined();
  });

  it("MAD는 이상치 한 프레임에 흔들리지 않는다", () => {
    expect(medianAbsoluteDeviation([1, 1, 1, 1, 9])).toBe(0);
  });
});

describe("반복 측정 (§9 동일 손 연속 3회)", () => {
  it("같은 손을 3회 반복 관찰하면 폭 비율 변동이 작다", () => {
    const opts = { bodyHalf: 9, dipRadial: 13, dipUlnar: 10 };
    const runs = [aggregateOf(opts, 10), aggregateOf(opts, 10), aggregateOf(opts, 10)];
    const values = runs.map((a) => a.fingers.find((f) => f.key === "index").dipWidthRatio);
    values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread).toBeLessThan(0.1);
  });

  it("DIP 말림·좌우 편위가 있어도 관찰이 성립한다", () => {
    const curled = measureOne({ angleDeg: 18, dipRadial: 14, dipUlnar: 8 });
    expect(curled.ok).toBe(true);
    expect(curled.contourAsymmetryRatio).toBeGreaterThan(0);
  });
});

describe("저장 payload (§7)", () => {
  it("파생 비율과 품질값만 담고 이미지·좌표는 담지 않는다", () => {
    const agg = aggregateOf({ bodyHalf: 9, dipRadial: 13, dipUlnar: 10 }, 10);
    const payload = buildDipContourPayload(agg);
    expect(payload.measurementVersion).toBe(MEASUREMENT_VERSION);
    const f = payload.fingers[0];
    ["dipWidthRatio", "radialHalfWidthRatio", "ulnarHalfWidthRatio", "contourAsymmetryRatio",
     "validFrames", "stabilityMad"].forEach((k) => expect(f).toHaveProperty(k));

    const s = JSON.stringify(payload);
    expect(s).not.toMatch(/imageData|mask|contour"|landmark|photo|video|"data"/i);
    expect(s).not.toMatch(/"x":|"y":/);
  });

  it("관찰에 실패하면 payload를 만들지 않는다(0 저장 금지)", () => {
    const agg = aggregateOf({ drawFinger: false }, 10);
    expect(buildDipContourPayload(agg)).toBeNull();
  });

  it("일부 손가락만 실패하면 그 손가락은 제외하고 저장한다", () => {
    const agg = aggregateOf({ bodyHalf: 9, dipRadial: 12, dipUlnar: 12 }, 10);
    agg.fingers[1].ok = false;
    delete agg.fingers[1].dipWidthRatio;
    const payload = buildDipContourPayload(agg);
    expect(payload.fingers.every((f) => Number.isFinite(f.dipWidthRatio))).toBe(true);
  });
});

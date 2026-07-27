// P0-14 §6 — 측면(ok_fan_lateral) 외곽 프로파일 관찰 테스트.
// 합성 ImageData(수직 막대)로 검증한다. 방향은 sideA/sideB(부호 없음)로만 다룬다.
import { describe, it, expect } from "vitest";
import {
  DIP_ROI_CHAINS, CONTOUR_FLAG, MEASUREMENT_VERSION,
  measureFingerSideProfile, measureFrameSideProfiles,
  aggregateSideProfileFrames, buildSideProfilePayload, SIDE_PROFILE_FINGERS,
} from "./dipContour";

const W = 240;
const H = 320;

function blankImage(bg = [30, 30, 30]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255;
  }
  return { width: W, height: H, data };
}
function setPx(img, x, y, rgb) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return;
  const o = (yi * img.width + xi) * 4;
  img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
}

// 수직 손가락(축 -y). 몸통 반폭 bodyHalf, DIP 구간(t 0.46~0.76) sideA(우)/sideB(좌).
// chainKey로 어떤 손가락 landmark 인덱스에 좌표를 넣을지 정한다(나머지는 같은 자리).
function makeSideFrame({ bodyHalf = 9, sideA = 9, sideB = 9, jitter = 0, fg = [210, 170, 150] } = {}) {
  const img = blankImage();
  const centerX = W / 2, centerY = H / 2;
  const L = 140;
  const axis = { x: 0, y: -1 };
  const perp = { x: 1, y: 0 }; // +perp = sideA(우), -perp = sideB(좌)
  const pip = { x: centerX, y: centerY + L / 2 };
  const dip = { x: centerX, y: centerY + L / 2 - L * 0.6 };
  const tip = { x: centerX, y: centerY + L / 2 - L };
  const halfAt = (t) => (t >= 0.46 && t <= 0.76 ? { a: sideA, b: sideB } : { a: bodyHalf, b: bodyHalf });
  const steps = Math.ceil(L * 3);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const cx = pip.x + axis.x * L * t + (jitter ? (Math.sin(i) * jitter) : 0);
    const cy = pip.y + axis.y * L * t;
    const { a, b } = halfAt(t);
    for (let d = 0; d <= a; d += 0.5) setPx(img, cx + perp.x * d, cy + perp.y * d, fg);
    for (let d = 0; d <= b; d += 0.5) setPx(img, cx - perp.x * d, cy - perp.y * d, fg);
  }
  const lm = [];
  const put = (i, p) => { lm[i] = { x: p.x / W, y: p.y / H }; };
  put(0, { x: centerX, y: centerY + L });
  put(5, { x: centerX + 40, y: centerY });
  put(17, { x: centerX - 40, y: centerY });
  Object.values(DIP_ROI_CHAINS).forEach((c) => { put(c.pip, pip); put(c.dip, dip); put(c.tip, tip); });
  return { img, lm };
}

describe("measureFingerSideProfile (§6)", () => {
  it("대칭 측면 프로파일을 관찰하고 비대칭은 ~0", () => {
    const { img, lm } = makeSideFrame({ bodyHalf: 9, sideA: 12, sideB: 12 });
    const r = measureFingerSideProfile(img, lm, DIP_ROI_CHAINS.middle);
    expect(r.ok).toBe(true);
    expect(r.sideProfileObserved).toBe(true);
    expect(r.dipSideProfileRatio).toBeGreaterThan(1); // DIP가 몸통보다 넓음
    expect(r.sideProfileAsymmetryRatio).toBeLessThan(0.15);
    // 계산 단면과 같은 캘리퍼 좌표(정규화)가 나온다.
    expect(r.displayGeometry.sideEdgeA).toBeTruthy();
    expect(r.displayGeometry.sideEdgeB).toBeTruthy();
  });

  it("비대칭은 부호 없이(항상 ≥0) 나온다 — 어느 쪽이 넓든 크기만", () => {
    const fA = makeSideFrame({ bodyHalf: 8, sideA: 14, sideB: 7 });
    const fB = makeSideFrame({ bodyHalf: 8, sideA: 7, sideB: 14 });
    const rA = measureFingerSideProfile(fA.img, fA.lm, DIP_ROI_CHAINS.middle);
    const rB = measureFingerSideProfile(fB.img, fB.lm, DIP_ROI_CHAINS.middle);
    expect(rA.sideProfileAsymmetryRatio).toBeGreaterThanOrEqual(0);
    expect(rB.sideProfileAsymmetryRatio).toBeGreaterThanOrEqual(0);
    // 좌우를 뒤집어도 비대칭 크기는 비슷하다(부호 없음).
    expect(Math.abs(rA.sideProfileAsymmetryRatio - rB.sideProfileAsymmetryRatio)).toBeLessThan(0.2);
  });

  it("해부학적 방향(radial/ulnar) 이름을 만들지 않는다 — sideA/sideB만", () => {
    const { img, lm } = makeSideFrame({ sideA: 12, sideB: 10 });
    const r = measureFingerSideProfile(img, lm, DIP_ROI_CHAINS.ring);
    expect(r).not.toHaveProperty("radialHalfWidthRatio");
    expect(r).not.toHaveProperty("contourAsymmetryRatio");
    expect(r).toHaveProperty("sideAHalfProfileRatio");
    expect(r).toHaveProperty("sideBHalfProfileRatio");
  });

  it("landmark가 없으면 LANDMARK_MISSING", () => {
    const { img } = makeSideFrame();
    const r = measureFingerSideProfile(img, [], DIP_ROI_CHAINS.middle);
    expect(r.ok).toBe(false);
    expect(r.flags).toContain(CONTOUR_FLAG.LANDMARK_MISSING);
  });
});

describe("aggregate/build side profile (§9)", () => {
  const frames = (n, opts) => Array.from({ length: n }, () => {
    const { img, lm } = makeSideFrame(opts);
    return measureFrameSideProfiles(img, lm);
  });

  it("측면 함수는 중지·약지·소지만 다룬다(검지 필수 아님)", () => {
    expect(SIDE_PROFILE_FINGERS).toEqual(["middle", "ring", "pinky"]);
    const f = makeSideFrame();
    const one = measureFrameSideProfiles(f.img, f.lm);
    expect(one.map((r) => r.key)).toEqual(["middle", "ring", "pinky"]);
  });

  it("유효 프레임이 충분하면 sideProfileObserved:true, payload에 관찰값이 담긴다", () => {
    const agg = aggregateSideProfileFrames(frames(10, { sideA: 12, sideB: 11 }));
    expect(agg.ok).toBe(true);
    const payload = buildSideProfilePayload(agg);
    expect(payload.measurementVersion).toBe(MEASUREMENT_VERSION);
    const middle = payload.fingers.find((f) => f.key === "middle");
    expect(middle.sideProfileObserved).toBe(true);
    expect(middle.dipSideProfileRatio).toBeGreaterThan(0);
    expect(middle).toHaveProperty("relativeVariation");
  });

  it("유효 프레임 부족 → sideProfileObserved:false, 0으로 채우지 않는다", () => {
    const agg = aggregateSideProfileFrames(frames(3, { sideA: 12, sideB: 11 }));
    const payload = buildSideProfilePayload(agg);
    const middle = payload.fingers.find((f) => f.key === "middle");
    expect(middle.sideProfileObserved).toBe(false);
    expect(middle.dipSideProfileRatio).toBeUndefined(); // 0이 아니라 아예 없음
  });

  it("payload에는 displayGeometry(좌표)가 새어 나오지 않는다(§9)", () => {
    const agg = aggregateSideProfileFrames(frames(10, { sideA: 12, sideB: 11 }));
    const payload = buildSideProfilePayload(agg);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/displayGeometry|sideEdge|xNorm|yNorm|dipCenter/);
  });
});

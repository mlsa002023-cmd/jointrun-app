// dipCaliperOverlay — 촬영 중 DIP 캘리퍼 오버레이 (RC1.2.2 P0-11)
import { describe, it, expect, vi } from "vitest";
import {
  CALIPER_STATE,
  deriveFingerState,
  deriveOverlayModel,
  drawCaliperOverlay,
} from "./dipCaliperOverlay";
import { CONTOUR_FLAG, MIN_VALID_FRAMES, measureFingerDipContour, resolveRadialSign, DIP_ROI_CHAINS } from "./dipContour";

/** 캔버스 ctx 목 — 그려진 선분을 기록한다. */
function mockCtx() {
  const lines = [];
  let cur = null;
  return {
    lines,
    save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
    arc: vi.fn(),
    beginPath: vi.fn(() => { cur = { pts: [] }; }),
    moveTo: vi.fn((x, y) => { cur?.pts.push([x, y]); }),
    lineTo: vi.fn((x, y) => { cur?.pts.push([x, y]); }),
    stroke: vi.fn(() => { if (cur?.pts.length >= 2) lines.push(cur.pts); }),
    lineWidth: 1, strokeStyle: "", fillStyle: "", font: "",
    // P0-11.1 — 렌더러는 정규화 좌표를 이 캔버스 크기로 변환한다.
    canvas: { width: 1000, height: 1000 },
  };
}

// 정규화 좌표(0..1). 1000×1000 캔버스에서 예전 픽셀값과 같은 위치가 된다.
const geo = (over = {}) => ({
  dipCenter: { xNorm: 0.100, yNorm: 0.100 },
  axisStart: { xNorm: 0.100, yNorm: 0.080 },
  axisEnd: { xNorm: 0.100, yNorm: 0.120 },
  radialEdge: { xNorm: 0.112, yNorm: 0.100 },
  ulnarEdge: { xNorm: 0.088, yNorm: 0.100 },
  ...over,
});

const measurement = (over = {}) => ({ key: "index", ok: true, flags: [], displayGeometry: geo(), ...over });

describe("상태 판정 (§3)", () => {
  it("A. landmark가 없으면 탐색 중", () => {
    const s = deriveFingerState({ measurement: null, hasLandmarks: false });
    expect(s.state).toBe(CALIPER_STATE.SEARCHING);
    expect(s.message).toBe("손가락을 화면 안에 맞춰 주세요");
  });

  it("B. landmark는 있고 contour가 아직이면 대기", () => {
    const s = deriveFingerState({ measurement: { ok: false, flags: [] }, hasLandmarks: true });
    expect(s.state).toBe(CALIPER_STATE.LANDMARK_READY);
    expect(s.message).toBe("손가락을 벌리고 잠시 유지해 주세요");
  });

  it("C. 수집 중이면 진행 상태를 4/7 형태로 알린다", () => {
    const s = deriveFingerState({ measurement: measurement(), hasLandmarks: true, validFrames: 4 });
    expect(s.state).toBe(CALIPER_STATE.MEASURING);
    expect(s.message).toBe(`끝마디 외곽 관찰 중 · 4/${MIN_VALID_FRAMES}`);
  });

  it("C. 일반 사용자에게 실시간 폭 비율 숫자를 노출하지 않는다", () => {
    const s = deriveFingerState({
      measurement: measurement({ dipWidthRatio: 1.23, contourAsymmetryRatio: 0.4 }),
      hasLandmarks: true, validFrames: 3,
    });
    expect(s.message).not.toMatch(/1\.2|123|0\.4|%/);
  });

  it("D. 유효 프레임을 다 모으면 완료", () => {
    const s = deriveFingerState({ measurement: measurement(), hasLandmarks: true, validFrames: MIN_VALID_FRAMES });
    expect(s.state).toBe(CALIPER_STATE.DONE);
    expect(s.message).toBe("끝마디 외곽 기록 완료");
  });

  it("실패 사유마다 다른 안내 문구를 준다", () => {
    const cases = [
      [CONTOUR_FLAG.FINGER_OVERLAP, "손가락을 조금 더 벌려 주세요"],
      [CONTOUR_FLAG.LOW_CONTRAST, "배경과 손이 잘 구분되도록 옮겨 주세요"],
      [CONTOUR_FLAG.ROI_OUT_OF_BOUNDS, "손을 화면 안쪽으로 이동해 주세요"],
      [CONTOUR_FLAG.CONTOUR_BROKEN, "잠시 움직이지 말고 유지해 주세요"],
    ];
    cases.forEach(([flag, msg]) => {
      const s = deriveFingerState({ measurement: { ok: false, flags: [flag] }, hasLandmarks: true });
      expect(s.state).toBe(CALIPER_STATE.UNSTABLE);
      expect(s.message).toBe(msg);
    });
  });
});

describe("화면 혼잡도 (§4)", () => {
  it("측정 중인 손가락 하나만 focus로 잡는다", () => {
    const frame = [
      { key: "index", ok: true, flags: [], displayGeometry: geo() },
      { key: "middle", ok: true, flags: [], displayGeometry: geo() },
    ];
    const m = deriveOverlayModel(frame, { index: 2, middle: 3 }, true);
    expect(m.focusKey).toBe("index");
  });

  it("전부 완료되면 완료 상태를 알린다", () => {
    const frame = Object.keys(DIP_ROI_CHAINS).map((key) => ({ key, ok: true, flags: [], displayGeometry: geo() }));
    const counts = Object.fromEntries(Object.keys(DIP_ROI_CHAINS).map((k) => [k, MIN_VALID_FRAMES]));
    const m = deriveOverlayModel(frame, counts, true);
    expect(m.allDone).toBe(true);
    expect(m.doneCount).toBe(4);
    expect(m.statusText).toBe("끝마디 외곽 기록 완료");
  });

  it("손이 없으면 탐색 안내를 보여준다", () => {
    const m = deriveOverlayModel(null, {}, false);
    expect(m.statusText).toBe("손가락을 화면 안에 맞춰 주세요");
  });
});

describe("캘리퍼 기하 — 중심축에 수직 (§2)", () => {
  /** 두 선분이 이루는 각도(도). */
  function angleBetween(a, b) {
    const v1 = { x: a[1][0] - a[0][0], y: a[1][1] - a[0][1] };
    const v2 = { x: b[1][0] - b[0][0], y: b[1][1] - b[0][1] };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  }

  it("손가락 축이 수직이면 폭 측정선은 수평이다", () => {
    const ctx = mockCtx();
    const model = deriveOverlayModel([measurement()], { index: 3 }, true);
    drawCaliperOverlay(ctx, model);
    const axis = ctx.lines[0];
    const width = ctx.lines[1];
    expect(Math.abs(angleBetween(axis, width) - 90)).toBeLessThan(1);
    expect(Math.abs(width[0][1] - width[1][1])).toBeLessThan(1); // 수평
  });

  it("손가락이 회전하면 폭 측정선도 함께 회전해 수직 관계를 유지한다", () => {
    // 축을 40도 기울인 geometry
    const r = (40 * Math.PI) / 180;
    const ax = { x: Math.sin(r), y: -Math.cos(r) };
    const perp = { x: -ax.y, y: ax.x };
    const c = { x: 100, y: 100 };
    const N = (x, y) => ({ xNorm: x / 1000, yNorm: y / 1000 });
    const rotated = geo({
      axisStart: N(c.x - ax.x * 20, c.y - ax.y * 20),
      axisEnd: N(c.x + ax.x * 20, c.y + ax.y * 20),
      radialEdge: N(c.x + perp.x * 12, c.y + perp.y * 12),
      ulnarEdge: N(c.x - perp.x * 12, c.y - perp.y * 12),
    });
    const ctx = mockCtx();
    const model = deriveOverlayModel([measurement({ displayGeometry: rotated })], { index: 3 }, true);
    drawCaliperOverlay(ctx, model);
    expect(Math.abs(angleBetween(ctx.lines[0], ctx.lines[1]) - 90)).toBeLessThan(1);
    // 화면 기준 수평선이 아니다(§2 금지)
    expect(Math.abs(ctx.lines[1][0][1] - ctx.lines[1][1][1])).toBeGreaterThan(1);
  });
});

describe("QA 전용 상세 (§8)", () => {
  it("일반 사용자에게는 숫자·디버그 문자열을 그리지 않는다", () => {
    const ctx = mockCtx();
    const model = deriveOverlayModel([measurement()], { index: 3 }, true);
    drawCaliperOverlay(ctx, model, { qaDetail: false });
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("QA 계정에는 프레임 수와 실패 사유를 표시한다", () => {
    const ctx = mockCtx();
    const model = deriveOverlayModel(
      [{ key: "index", ok: false, flags: [CONTOUR_FLAG.LOW_CONTRAST], displayGeometry: geo() }],
      { index: 2 }, true
    );
    drawCaliperOverlay(ctx, model, { qaDetail: true });
    expect(ctx.fillText).toHaveBeenCalled();
    const text = ctx.fillText.mock.calls[0][0];
    expect(text).toContain("index");
    expect(text).toContain(CONTOUR_FLAG.LOW_CONTRAST);
  });
});

describe("landmark 누락·저장 금지", () => {
  it("geometry가 없으면 아무것도 그리지 않는다", () => {
    const ctx = mockCtx();
    const model = deriveOverlayModel([{ key: "index", ok: false, flags: [], displayGeometry: null }], {}, true);
    drawCaliperOverlay(ctx, model);
    expect(ctx.lines.length).toBe(0);
  });

  it("displayGeometry는 저장 payload에 들어가지 않는다", async () => {
    const { buildDipContourPayload, aggregateDipContourFrames } = await import("./dipContour");
    const frames = Array.from({ length: 10 }, () => [{
      key: "index", name: "검지", ok: true, flags: [],
      dipWidthRatio: 1.0, radialHalfWidthRatio: 0.5, ulnarHalfWidthRatio: 0.5, contourAsymmetryRatio: 0,
      displayGeometry: geo(),
    }]);
    const payload = buildDipContourPayload(aggregateDipContourFrames(frames));
    expect(JSON.stringify(payload)).not.toMatch(/displayGeometry|dipCenter|axisStart|radialEdge|"x":/);
  });
});

describe("실제 측정 결과와 연결", () => {
  it("measureFingerDipContour가 성공하면 표시용 geometry를 함께 돌려준다", () => {
    // 세로 막대 손가락을 그린 합성 이미지
    const W = 200, H = 260;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i += 1) { data[i * 4] = 20; data[i * 4 + 1] = 20; data[i * 4 + 2] = 20; data[i * 4 + 3] = 255; }
    const img = { width: W, height: H, data };
    for (let y = 60; y < 200; y += 1) {
      for (let x = 91; x <= 109; x += 1) {
        const o = (y * W + x) * 4;
        data[o] = 210; data[o + 1] = 170; data[o + 2] = 150;
      }
    }
    const lm = [];
    lm[0] = { x: 0.5, y: 0.95 };
    lm[5] = { x: 0.7, y: 0.6 };
    lm[17] = { x: 0.3, y: 0.6 };
    const chain = DIP_ROI_CHAINS.index;
    lm[chain.pip] = { x: 100 / W, y: 190 / H };
    lm[chain.dip] = { x: 100 / W, y: 110 / H };
    lm[chain.tip] = { x: 100 / W, y: 65 / H };

    const sign = resolveRadialSign(lm, W, H, chain);
    const r = measureFingerDipContour(img, lm, chain, sign);
    expect(r.ok).toBe(true);
    expect(r.displayGeometry.dipCenter).toBeTruthy();
    expect(r.displayGeometry.radialEdge).toBeTruthy();
    expect(r.displayGeometry.ulnarEdge).toBeTruthy();
  });
});

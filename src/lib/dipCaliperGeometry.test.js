// P0-11.1 — 캘리퍼 좌표계·관절 중심 정합 회귀
//
// 핵심 결함: displayGeometry가 축소된 분석 캔버스의 절대 픽셀이었고, 오버레이는 그것을
// video 원본 크기 캔버스에 그려서 축소 배율만큼 어긋난 위치에 표시됐다.
import { describe, it, expect } from "vitest";
import {
  DIP_ROI_CHAINS,
  measureFingerDipContour,
  measureFrameDipContours,
  resolveRadialSign,
  aggregateDipContourFrames,
  buildDipContourPayload,
  stripTransientGeometry,
} from "./dipContour";
import { normalizedPointToCanvas, deriveOverlayModel } from "./dipCaliperOverlay";

/**
 * 세로 막대 손가락을 그린 합성 프레임. 어떤 해상도에서도 같은 normalized landmark를 쓴다.
 * (분석 해상도 불변성을 검증하기 위한 핵심 장치)
 */
function makeFrame(W, H, { angleDeg = 0 } = {}) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    data[i * 4] = 20; data[i * 4 + 1] = 20; data[i * 4 + 2] = 20; data[i * 4 + 3] = 255;
  }
  const img = { width: W, height: H, data };

  const rad = (angleDeg * Math.PI) / 180;
  const axis = { x: Math.sin(rad), y: -Math.cos(rad) };
  const perp = { x: -axis.y, y: axis.x };
  const cx = W * 0.5;
  const cy = H * 0.5;
  const L = Math.min(W, H) * 0.45;
  const half = Math.min(W, H) * 0.035;

  const pipPt = { x: cx - axis.x * L * 0.5, y: cy - axis.y * L * 0.5 };
  const tipPt = { x: pipPt.x + axis.x * L, y: pipPt.y + axis.y * L };
  const dipPt = { x: pipPt.x + axis.x * L * 0.6, y: pipPt.y + axis.y * L * 0.6 };

  const steps = Math.ceil(L * 4);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px0 = pipPt.x + axis.x * L * t;
    const py0 = pipPt.y + axis.y * L * t;
    for (let d = -half; d <= half; d += 0.4) {
      const x = Math.round(px0 + perp.x * d);
      const y = Math.round(py0 + perp.y * d);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4;
      data[o] = 210; data[o + 1] = 170; data[o + 2] = 150;
    }
  }

  const lm = [];
  lm[0] = { x: 0.5, y: 0.95 };
  lm[5] = { x: (cx + perp.x * W * 0.15) / W, y: (cy + perp.y * H * 0.15) / H };
  lm[17] = { x: (cx - perp.x * W * 0.15) / W, y: (cy - perp.y * H * 0.15) / H };
  Object.values(DIP_ROI_CHAINS).forEach((c) => {
    lm[c.pip] = { x: pipPt.x / W, y: pipPt.y / H };
    lm[c.dip] = { x: dipPt.x / W, y: dipPt.y / H };
    lm[c.tip] = { x: tipPt.x / W, y: tipPt.y / H };
  });
  return { img, lm };
}

function measureIndex(W, H, opts) {
  const { img, lm } = makeFrame(W, H, opts);
  const chain = DIP_ROI_CHAINS.index;
  const sign = resolveRadialSign(lm, W, H, chain);
  return { result: measureFingerDipContour(img, lm, chain, sign), lm, chain };
}

describe("A. 분석 해상도 불변성 (§10-A)", () => {
  it("1280×720 / 480×270 / 320×180에서 normalized dipCenter가 같다", () => {
    const sizes = [[1280, 720], [480, 270], [320, 180]];
    const centers = sizes.map(([w, h]) => measureIndex(w, h).result.displayGeometry.dipCenter);
    centers.forEach((c) => {
      expect(Math.abs(c.xNorm - centers[0].xNorm)).toBeLessThan(0.001);
      expect(Math.abs(c.yNorm - centers[0].yNorm)).toBeLessThan(0.001);
    });
  });

  it("해상도가 달라도 폭 비율이 유지된다", () => {
    const a = measureIndex(1280, 720).result;
    const b = measureIndex(320, 180).result;
    expect(a.ok && b.ok).toBe(true);
    expect(Math.abs(a.dipWidthRatio - b.dipWidthRatio)).toBeLessThan(0.25);
  });
});

describe("B. 십자가 중심 = 정확한 DIP landmark (§10-B)", () => {
  it("normalized dipCenter가 landmark 값과 일치한다", () => {
    const { result, lm, chain } = measureIndex(960, 540);
    const g = result.displayGeometry.dipCenter;
    expect(Math.abs(g.xNorm - lm[chain.dip].x)).toBeLessThan(1e-6);
    expect(Math.abs(g.yNorm - lm[chain.dip].y)).toBeLessThan(1e-6);
  });

  it("네 손가락 모두 각자의 DIP landmark를 중심으로 쓴다", () => {
    const W = 800, H = 600;
    const { img, lm } = makeFrame(W, H);
    measureFrameDipContours(img, lm).forEach((f) => {
      const chain = DIP_ROI_CHAINS[f.key];
      expect(Math.abs(f.displayGeometry.dipCenter.xNorm - lm[chain.dip].x)).toBeLessThan(1e-6);
      expect(Math.abs(f.displayGeometry.dipCenter.yNorm - lm[chain.dip].y)).toBeLessThan(1e-6);
    });
  });

  it("캔버스 크기가 달라도 기대 픽셀 위치와 ±1px 안이다", () => {
    const { result, lm, chain } = measureIndex(480, 270);
    const canvas = { width: 1280, height: 720 };
    const drawn = normalizedPointToCanvas(result.displayGeometry.dipCenter, canvas);
    const expected = { x: lm[chain.dip].x * canvas.width, y: lm[chain.dip].y * canvas.height };
    expect(Math.abs(drawn.x - expected.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawn.y - expected.y)).toBeLessThanOrEqual(1);
  });
});

describe("C·D·E. 측정선 기하 (§10-C/D/E)", () => {
  const { result } = measureIndex(960, 540, { angleDeg: 25 });
  const g = result.displayGeometry;

  it("radialEdge · dipCenter · ulnarEdge가 한 직선 위에 있다", () => {
    const v1 = { x: g.dipCenter.xNorm - g.ulnarEdge.xNorm, y: g.dipCenter.yNorm - g.ulnarEdge.yNorm };
    const v2 = { x: g.radialEdge.xNorm - g.ulnarEdge.xNorm, y: g.radialEdge.yNorm - g.ulnarEdge.yNorm };
    expect(Math.abs(v1.x * v2.y - v1.y * v2.x)).toBeLessThan(1e-4);
  });

  // 수직성은 실제로 그려지는 캔버스 픽셀 공간에서 성립해야 한다.
  // normalized 좌표는 x/W · y/H로 축마다 배율이 달라(비등방 스케일) 각도가 보존되지 않는다.
  // 그리기 캔버스는 원본과 같은 종횡비이므로 변환 후 수직성이 복원된다.
  it("중심축과 폭 방향이 캔버스 픽셀 공간에서 수직이다", () => {
    const canvas = { width: 1920, height: 1080 }; // 원본과 같은 16:9
    const P = (pt) => normalizedPointToCanvas(pt, canvas);
    const a1 = P(g.axisStart), a2 = P(g.axisEnd);
    const e1 = P(g.radialEdge), e2 = P(g.ulnarEdge);
    const t = { x: a2.x - a1.x, y: a2.y - a1.y };
    const wdir = { x: e1.x - e2.x, y: e1.y - e2.y };
    const tl = Math.hypot(t.x, t.y), wl = Math.hypot(wdir.x, wdir.y);
    expect(Math.abs((t.x * wdir.x + t.y * wdir.y) / (tl * wl))).toBeLessThan(1e-4);
  });

  it("dipCenter가 두 외곽점 사이에 있다", () => {
    const between = (c, a, b) => (c >= Math.min(a, b) - 1e-9 && c <= Math.max(a, b) + 1e-9);
    expect(between(g.dipCenter.xNorm, g.radialEdge.xNorm, g.ulnarEdge.xNorm)).toBe(true);
    expect(between(g.dipCenter.yNorm, g.radialEdge.yNorm, g.ulnarEdge.yNorm)).toBe(true);
  });

  it("손가락이 회전하면 폭 측정선도 회전한다(화면 수평선 아님)", () => {
    const tilted = measureIndex(960, 540, { angleDeg: 35 }).result.displayGeometry;
    expect(Math.abs(tilted.radialEdge.yNorm - tilted.ulnarEdge.yNorm)).toBeGreaterThan(1e-3);
  });
});

describe("F. stale geometry (§10-F)", () => {
  it("손 미검출 프레임에서는 오버레이 모델을 만들지 않는다", () => {
    const model = deriveOverlayModel(null, { index: 12 }, false);
    model.fingers.forEach((f) => expect(f.geometry).toBeNull());
  });

  it("목표 프레임을 채운 뒤에도 새 위치로 갱신된다", () => {
    const a = measureFrameDipContours(...Object.values(makeFrame(800, 600)).slice(0, 2));
    const moved = makeFrame(800, 600, { angleDeg: 20 });
    const b = measureFrameDipContours(moved.img, moved.lm);
    const counts = { index: 12, middle: 12, ring: 12, pinky: 12 }; // 이미 목표 도달
    const modelA = deriveOverlayModel(a, counts, true);
    const modelB = deriveOverlayModel(b, counts, true);
    const ca = modelA.fingers.find((f) => f.key === "index").geometry.dipCenter;
    const cb = modelB.fingers.find((f) => f.key === "index").geometry.dipCenter;
    expect(Math.abs(ca.xNorm - cb.xNorm) + Math.abs(ca.yNorm - cb.yNorm)).toBeGreaterThan(0.005);
  });
});

describe("G. 저장물에 좌표 없음 (§10-G)", () => {
  it("stripTransientGeometry가 displayGeometry를 떼어낸다", () => {
    const { img, lm } = makeFrame(640, 480);
    const measured = measureFrameDipContours(img, lm);
    expect(measured[0].displayGeometry).toBeTruthy();
    const stripped = stripTransientGeometry(measured);
    stripped.forEach((f) => expect(f.displayGeometry).toBeUndefined());
    expect(stripped[0].dipWidthRatio).toBe(measured[0].dipWidthRatio);
  });

  it("누적 버퍼와 저장 payload 어디에도 좌표가 없다", () => {
    const { img, lm } = makeFrame(640, 480);
    const frames = Array.from({ length: 10 }, () => stripTransientGeometry(measureFrameDipContours(img, lm)));
    const serializedFrames = JSON.stringify(frames);
    expect(serializedFrames).not.toMatch(/displayGeometry|dipCenter|radialEdge|ulnarEdge|xNorm|yNorm/);

    const payload = buildDipContourPayload(aggregateDipContourFrames(frames));
    expect(JSON.stringify(payload)).not.toMatch(/displayGeometry|dipCenter|radialEdge|ulnarEdge|xNorm|yNorm|contourPath/);
  });
});

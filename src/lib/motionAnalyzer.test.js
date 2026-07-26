// motionAnalyzer — 좌우 손 굴곡각 회귀 (RC1.2.2 P0-10)
//
// 실기기(왼손) 검수에서 평균 ROM과 손가락 각도가 전부 0°로 나왔다. 원인은 palmNorm이
// cross(indexMCP-wrist, pinkyMCP-wrist)라 왼손에서 부호가 뒤집히고, atan2(fy, fx)가
// 음수가 되어 Math.max(0, ...)에 전부 걸린 것이었다. 같은 자세라면 좌우 손에서 굴곡각이
// 같게 나와야 한다.
import { describe, it, expect } from "vitest";
import { analyzePIPJoint, analyzeAllFingers, FINGER_CHAINS } from "./motionAnalyzer";

/**
 * 굴곡각이 flexDeg인 합성 손. hand="left"면 x축을 미러링한다.
 * 좌표: x=엄지쪽, y=손가락 방향, z=손등쪽. 굴곡은 -z(손바닥) 방향.
 */
function makeHand(flexDeg, hand = "right") {
  const lm = [];
  const set = (i, x, y, z) => { lm[i] = { x: hand === "left" ? -x : x, y, z }; };
  const r = (flexDeg * Math.PI) / 180;
  const SEG = 3;

  set(0, 0, 0, 0);
  const mcpX = { index: 3, middle: 1, ring: -1, pinky: -3 };
  Object.entries(FINGER_CHAINS).forEach(([key, c]) => {
    const x0 = mcpX[key];
    set(c.mcp, x0, 4, 0);
    set(c.pip, x0, 4 + SEG, 0);
    set(c.dip, x0, 4 + SEG + SEG * Math.cos(r), -SEG * Math.sin(r));
  });
  return lm;
}

describe("analyzePIPJoint — 좌우 손 대칭", () => {
  it("오른손에서 굴곡각을 계산한다", () => {
    const lm = makeHand(45, "right");
    const r = analyzePIPJoint(lm, 5, 6, 7);
    expect(r.flexion).toBeGreaterThan(40);
    expect(r.flexion).toBeLessThan(50);
  });

  it("왼손에서도 같은 굴곡각을 계산한다(0으로 무너지지 않는다)", () => {
    const lm = makeHand(45, "left");
    const r = analyzePIPJoint(lm, 5, 6, 7);
    expect(r.flexion).toBeGreaterThan(40);
    expect(r.flexion).toBeLessThan(50);
  });

  it("같은 자세라면 좌우 손의 굴곡각 차이가 거의 없다", () => {
    const right = analyzePIPJoint(makeHand(60, "right"), 5, 6, 7);
    const left = analyzePIPJoint(makeHand(60, "left"), 5, 6, 7);
    expect(Math.abs(right.flexion - left.flexion)).toBeLessThan(1);
  });

  it("편 손은 좌우 모두 굴곡각이 0에 가깝다", () => {
    expect(analyzePIPJoint(makeHand(0, "right"), 5, 6, 7).flexion).toBeLessThan(2);
    expect(analyzePIPJoint(makeHand(0, "left"), 5, 6, 7).flexion).toBeLessThan(2);
  });
});

describe("analyzeAllFingers — 왼손 ROM 회귀", () => {
  it("왼손의 네 손가락 굴곡각이 모두 0이 아니다", () => {
    const fingers = analyzeAllFingers(makeHand(50, "left"));
    expect(fingers).toHaveLength(4);
    fingers.forEach((f) => expect(f.flexion).toBeGreaterThan(30));
  });

  it("왼손에서도 펼침→주먹 차이(ROM)가 0이 아니다", () => {
    const spread = analyzeAllFingers(makeHand(5, "left"));
    const fist = analyzeAllFingers(makeHand(80, "left"));
    spread.forEach((s, i) => {
      const rom = fist[i].flexion - s.flexion;
      expect(rom).toBeGreaterThan(50);
    });
  });
});

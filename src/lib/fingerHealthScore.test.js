import { describe, it, expect } from "vitest";
import {
  computeMobilityScore, computeStabilityScore, computeInflammationScore,
  computeRecoveryScore, computeFingerHealthScore, DEFAULT_FINGER_HEALTH_SCORE,
} from "./fingerHealthScore";

// P0 안전 요건 — 데이터가 없을 때 50점 중립값을 대입하지 않고 null("측정 전")을 유지하는지 검증.
describe("fingerHealthScore — null(측정 전), 50점 중립값 금지", () => {
  it("DEFAULT_FINGER_HEALTH_SCORE는 50이 아니라 null이다", () => {
    expect(DEFAULT_FINGER_HEALTH_SCORE).toBeNull();
  });

  it("체크인이 없으면 Inflammation은 null", () => {
    expect(computeInflammationScore(null).value).toBeNull();
  });

  it("스캔·체크인이 둘 다 없으면 Recovery는 null", () => {
    expect(computeRecoveryScore(null, null).value).toBeNull();
  });

  it("스캔 데이터가 없으면 Mobility/Stability는 null", () => {
    expect(computeMobilityScore([]).value).toBeNull();
    expect(computeStabilityScore([]).value).toBeNull();
  });

  it("하위 점수 중 하나라도 null이면 Finger Health Score 총점도 null이다(50으로 대체하지 않음)", () => {
    const result = computeFingerHealthScore({
      mobility: { value: 80 }, stability: { value: 80 },
      inflammation: { value: null }, recovery: { value: 70 },
    });
    expect(result.total).toBeNull();
  });

  it("4개 하위 점수가 모두 있으면 정상적으로 가중합을 계산한다", () => {
    const result = computeFingerHealthScore({
      mobility: { value: 80 }, stability: { value: 80 },
      inflammation: { value: 80 }, recovery: { value: 80 },
    });
    expect(result.total).toBe(80);
  });
});

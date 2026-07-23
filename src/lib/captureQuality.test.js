import { describe, it, expect } from "vitest";
import {
  checkDistance, checkFraming, checkShake, checkLighting,
  evaluateCaptureQuality, evaluateComparability, isReliableCapture,
} from "./captureQuality";

function makeHandLandmarks({ centerX = 0.5, centerY = 0.5, span = 0.4 } = {}) {
  // 21개 랜드마크를 흉내낸 간단한 사각형 분포 — 실제 관절 구조는 아니지만 bbox 계산에는 충분하다.
  const half = span / 2;
  return Array.from({ length: 21 }, (_, i) => ({
    x: centerX + (i % 2 === 0 ? -half : half) * (i / 21),
    y: centerY + (i % 3 === 0 ? -half : half) * (i / 21),
  }));
}

describe("checkDistance", () => {
  it("손이 프레임을 충분히 채우면 ok", () => {
    expect(checkDistance(makeHandLandmarks({ span: 0.5 }))).toBe("ok");
  });
  it("손이 너무 작으면(멀리 있으면) too_far", () => {
    expect(checkDistance(makeHandLandmarks({ span: 0.05 }))).toBe("too_far");
  });
});

describe("checkFraming", () => {
  it("손이 프레임 중앙에 있으면 ok", () => {
    expect(checkFraming(makeHandLandmarks({ centerX: 0.5, centerY: 0.5, span: 0.3 }))).toBe("ok");
  });
  it("손이 가장자리에 걸치면 out_of_frame", () => {
    expect(checkFraming(makeHandLandmarks({ centerX: 0.01, centerY: 0.5, span: 0.3 }))).toBe("out_of_frame");
  });
});

describe("checkShake", () => {
  it("샘플이 3개 미만이면 판정을 보류하고 ok를 반환한다", () => {
    expect(checkShake([makeHandLandmarks()])).toBe("ok");
  });
  it("중심점이 거의 고정돼 있으면 ok", () => {
    const frames = Array.from({ length: 5 }, () => makeHandLandmarks({ centerX: 0.5, centerY: 0.5 }));
    expect(checkShake(frames)).toBe("ok");
  });
  it("중심점이 프레임마다 크게 움직이면 unstable", () => {
    const frames = [0.1, 0.9, 0.1, 0.9, 0.1].map((x) => makeHandLandmarks({ centerX: x, centerY: 0.5 }));
    expect(checkShake(frames)).toBe("unstable");
  });
});

describe("checkLighting", () => {
  it("null이면 unknown(차단하지 않음)", () => {
    expect(checkLighting(null)).toBe("unknown");
  });
  it("너무 어두우면 too_dark, 적당하면 ok, 너무 밝으면 too_bright", () => {
    expect(checkLighting(20)).toBe("too_dark");
    expect(checkLighting(140)).toBe("ok");
    expect(checkLighting(250)).toBe("too_bright");
  });
});

describe("evaluateCaptureQuality", () => {
  it("모두 ok면 pass", () => {
    const result = evaluateCaptureQuality({ distance: "ok", framing: "ok", shake: "ok", lighting: "ok" });
    expect(result.status).toBe("pass");
    expect(result.flags).toEqual([]);
  });
  it("하나만 실패하면 retry", () => {
    const result = evaluateCaptureQuality({ distance: "too_far", framing: "ok", shake: "ok", lighting: "ok" });
    expect(result.status).toBe("retry");
    expect(result.flags).toEqual(["too_far"]);
  });
  it("두 개 이상 실패하면 unreliable", () => {
    const result = evaluateCaptureQuality({ distance: "too_far", framing: "out_of_frame", shake: "ok", lighting: "ok" });
    expect(result.status).toBe("unreliable");
  });
  it("lighting이 unknown이면 실패로 세지 않는다", () => {
    const result = evaluateCaptureQuality({ distance: "ok", framing: "ok", shake: "ok", lighting: "unknown" });
    expect(result.status).toBe("pass");
  });
});

describe("isReliableCapture — 촬영 품질 예외 처리(4회 실패 후 강제저장)", () => {
  it("qualityStatus가 pass면 신뢰 가능", () => {
    expect(isReliableCapture({ qualityStatus: "pass" })).toBe(true);
  });
  it("qualityStatus가 unreliable(강제 저장)이면 신뢰 불가 — 정상 기준선/재확인으로 세지 않는다", () => {
    expect(isReliableCapture({ qualityStatus: "unreliable" })).toBe(false);
  });
  it("캡처 자체가 없으면 신뢰 불가", () => {
    expect(isReliableCapture(null)).toBe(false);
    expect(isReliableCapture(undefined)).toBe(false);
  });
});

describe("evaluateComparability — S09 과거의 나와 비교", () => {
  it("둘 다 있고 조건이 같으면 comparable", () => {
    const result = evaluateComparability(
      { handSide: "right", qualityStatus: "pass" },
      { handSide: "right", qualityStatus: "pass" },
    );
    expect(result.comparable).toBe(true);
  });
  it("손이 다르면 comparable하지 않다", () => {
    const result = evaluateComparability(
      { handSide: "right", qualityStatus: "pass" },
      { handSide: "left", qualityStatus: "pass" },
    );
    expect(result.comparable).toBe(false);
    expect(result.reasons).toContain("hand_side_mismatch");
  });
  it("캡처가 없으면 comparable하지 않다", () => {
    expect(evaluateComparability(null, null).comparable).toBe(false);
  });
  it("기준선이 강제저장(unreliable)이면 비교 신뢰도 경고 사유에 포함된다", () => {
    const result = evaluateComparability(
      { handSide: "right", qualityStatus: "unreliable" },
      { handSide: "right", qualityStatus: "pass" },
    );
    expect(result.comparable).toBe(false);
    expect(result.reasons).toContain("baseline_quality_unreliable");
  });
  it("현재 캡처가 강제저장(unreliable)이면 비교 신뢰도 경고 사유에 포함된다", () => {
    const result = evaluateComparability(
      { handSide: "right", qualityStatus: "pass" },
      { handSide: "right", qualityStatus: "unreliable" },
    );
    expect(result.comparable).toBe(false);
    expect(result.reasons).toContain("current_quality_unreliable");
  });
});

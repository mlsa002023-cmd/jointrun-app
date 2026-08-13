import { describe, it, expect } from "vitest";
import { isReportEventReady } from "./reportGate";
import { computeObservationTimepoints } from "./observationTrend";

const obs = [{ key: "middle", dipMaxFlexionDeg: 50, dipActiveRomDeg: 20 }];
const baselineCap = { type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "left", perFingerJointObservation: obs, capturedAt: "2026-08-02" };
const recheckCap = { type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "left", perFingerJointObservation: obs, capturedAt: "2026-08-16" };

describe("reportGate (FIX-1 §2) — 교차 루프 페어링 방지", () => {
  it("서로 다른 루프의 기준선/재확인을 교차 페어링해 리포트를 열지 않는다(회귀)", () => {
    const details = [
      { id: "new", baselineCaptureId: "capB", captures: [baselineCap] }, // 최신 기준선 루프(재확인 없음)
      { id: "old", captures: [recheckCap] },                             // 옛 재확인만 있는 다른 루프
    ];
    // 관찰 추이용 함수는 교차로 available=true (이 규칙 자체는 유지) …
    expect(computeObservationTimepoints(details).available).toBe(true);
    // … 그러나 리포트 게이트는 대상 루프(최신 기준선)에 재확인이 없으므로 열리면 안 된다.
    expect(isReportEventReady(details)).toBe(false);
  });

  it("대상 루프 안에 같은 방식 기준선+재확인이 있으면 리포트를 연다", () => {
    const details = [{ id: "e1", baselineCaptureId: "capB", captures: [baselineCap, recheckCap] }];
    expect(isReportEventReady(details)).toBe(true);
  });

  it("기준선만 있으면(재확인 없음) 리포트를 열지 않는다", () => {
    const details = [{ id: "e1", baselineCaptureId: "capB", captures: [baselineCap] }];
    expect(isReportEventReady(details)).toBe(false);
  });

  it("다른 손 재확인은 대상 루프 안에서도 비교 불가라 열지 않는다", () => {
    const details = [{
      id: "e1", baselineCaptureId: "capB",
      captures: [baselineCap, { ...recheckCap, handSide: "right" }],
    }];
    expect(isReportEventReady(details)).toBe(false);
  });

  it("기준선 이벤트가 없으면 false (throw 없음)", () => {
    expect(isReportEventReady([])).toBe(false);
    expect(isReportEventReady(null)).toBe(false);
    expect(isReportEventReady([{ id: "x", captures: [] }])).toBe(false);
  });
});

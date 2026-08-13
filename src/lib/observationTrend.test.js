import { describe, it, expect } from "vitest";
import { computeObservationTimepoints } from "./observationTrend";

const obs = [{ key: "middle", dipMaxFlexionDeg: 50, dipActiveRomDeg: 20 }];

describe("observationTrend (FIX-1 §5)", () => {
  it("같은 poseProtocolVersion·handSide로 baseline+recheck가 있으면 추이 available", () => {
    const details = [{
      id: "e1",
      captures: [
        { type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-01" },
        { type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-15" },
      ],
    }];
    const r = computeObservationTimepoints(details);
    expect(r.available).toBe(true);
    expect(r.timepoints.length).toBe(2);
    // 오래된 → 최신 순
    expect(r.timepoints[0].type).toBe("baseline");
    expect(r.timepoints[1].type).toBe("recheck");
  });

  it("baseline만 있으면(재확인 없음) available:false", () => {
    const details = [{ id: "e1", captures: [
      { type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-01" },
    ] }];
    expect(computeObservationTimepoints(details).available).toBe(false);
  });

  it("handSide가 다르면 같은 그룹이 아니라 available:false", () => {
    const details = [{ id: "e1", captures: [
      { type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-01" },
      { type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "left", perFingerJointObservation: obs, capturedAt: "2026-07-15" },
    ] }];
    expect(computeObservationTimepoints(details).available).toBe(false);
  });

  it("poseProtocolVersion이 다르면(구형↔신규) 추이에 섞지 않는다", () => {
    const details = [{ id: "e1", captures: [
      { type: "baseline", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-01" }, // 구형(no protocol)
      { type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-15" },
    ] }];
    expect(computeObservationTimepoints(details).available).toBe(false);
  });

  it("관찰값이 없는 capture는 시점으로 세지 않는다", () => {
    const details = [{ id: "e1", captures: [
      { type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: [], capturedAt: "2026-07-01" },
      { type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-15" },
    ] }];
    expect(computeObservationTimepoints(details).available).toBe(false);
  });

  it("여러 이벤트에 걸쳐 같은 방식 2시점이면 available", () => {
    const details = [
      { id: "e1", captures: [{ type: "baseline", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-01" }] },
      { id: "e2", captures: [{ type: "recheck", poseProtocolVersion: "front-fan-fist-v1", handSide: "right", perFingerJointObservation: obs, capturedAt: "2026-07-20" }] },
    ];
    expect(computeObservationTimepoints(details).available).toBe(true);
  });

  it("빈 입력은 available:false (throw 없음)", () => {
    expect(computeObservationTimepoints(null).available).toBe(false);
    expect(computeObservationTimepoints([]).available).toBe(false);
  });
});

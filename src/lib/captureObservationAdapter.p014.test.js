// P0-14 — 측면(fanLateral) view 매핑과 포즈 프로토콜 불일치 판정.
import { describe, it, expect } from "vitest";
import { toObservationView, hasPoseProtocolMismatch, hasSideContourOnBothSides } from "./captureObservationAdapter";

const newCap = (over = {}) => ({
  poseProtocolVersion: "front-fan-fist-v1",
  perFingerJointObservation: [{ key: "middle", name: "중지", dipMaxFlexionDeg: 50, dipActiveRomDeg: 20 }],
  contourObservations: {
    front: { fingers: [{ key: "middle", dipWidthRatio: 1.2, contourAsymmetryRatio: 0.03 }] },
    fanLateral: { fingers: [{ key: "middle", sideProfileObserved: true, dipSideProfileRatio: 1.1, sideProfileAsymmetryRatio: 0.05 }] },
  },
  handSide: "right",
  ...over,
});

describe("P0-14 adapter — 측면 view + pose protocol mismatch", () => {
  it("fanLateral 관찰을 sideContour로 노출한다(관찰된 손가락만)", () => {
    const v = toObservationView(newCap());
    const middle = v.fingers.find((f) => f.key === "middle");
    expect(middle.sideContour.dipSideProfileRatio).toBe(1.1);
    expect(middle.sideContour.sideProfileAsymmetryRatio).toBe(0.05);
  });

  it("sideProfileObserved:false면 sideContour는 null(0 위장 금지)", () => {
    const cap = newCap({ contourObservations: { fanLateral: { fingers: [{ key: "middle", sideProfileObserved: false, validFrames: 2 }] } } });
    const v = toObservationView(cap);
    expect(v.fingers.find((f) => f.key === "middle").sideContour).toBeNull();
  });

  it("구형(포즈 프로토콜 없음) ↔ 신규 = pose protocol mismatch", () => {
    const legacy = toObservationView({ perFingerJointObservation: [{ key: "middle", dipActiveRomDeg: 10 }], handSide: "right" });
    const current = toObservationView(newCap());
    expect(legacy.poseProtocolVersion).toBeNull();
    expect(hasPoseProtocolMismatch(legacy, current)).toBe(true);
  });

  it("같은 포즈 프로토콜끼리는 mismatch 아님", () => {
    expect(hasPoseProtocolMismatch(toObservationView(newCap()), toObservationView(newCap()))).toBe(false);
  });

  it("한쪽만 측면 관찰이 있으면 hasSideContourOnBothSides는 false", () => {
    const withSide = toObservationView(newCap());
    const noSide = toObservationView(newCap({ contourObservations: { front: { fingers: [{ key: "middle", dipWidthRatio: 1.1 }] } } }));
    expect(hasSideContourOnBothSides(withSide, noSide)).toBe(false);
    expect(hasSideContourOnBothSides(withSide, withSide)).toBe(true);
  });
});

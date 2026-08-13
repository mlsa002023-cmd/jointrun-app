// captureObservationAdapter — 세대 정규화 (RC1.2.2 P0-10)
import { describe, it, expect } from "vitest";
import {
  toObservationView,
  hasJointObservation,
  hasGenerationMismatch,
  pairFingerObservations,
  hasContourOnBothSides,
  OBSERVATION_GENERATION,
} from "./captureObservationAdapter";

const jointFinger = (over = {}) => ({
  key: "index", name: "검지",
  dipExtensionPoseFlexionDeg: 18.4, dipExtensionPoseDeviationDeg: -7.2,
  dipDeviationDirection: "ulnar", dipMaxFlexionDeg: 62, dipActiveRomDeg: 43.7,
  pipExtensionPoseFlexionDeg: 12, pipExtensionPoseDeviationDeg: 2.1,
  pipDeviationDirection: "radial", pipMaxFlexionDeg: 88, pipActiveRomDeg: 76,
  ...over,
});

const newCapture = (over = {}) => ({
  algorithmVersion: "v1.1",
  handSide: "left",
  capturedAt: new Date("2026-07-26T09:00:00Z"),
  perFingerJointObservation: [jointFinger()],
  deviationDirection: "ulnar",
  // 구형 호환 필드는 실기기에서 0으로 기록되기도 한다 — 신규 값을 덮어써선 안 된다.
  averageObservedRomDeg: 0,
  perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 0 }],
  symptomSnapshot: { painSelfReport: 5 },
  ...over,
});

const legacyCapture = (over = {}) => ({
  algorithmVersion: "v1.0",
  handSide: "left",
  capturedAt: new Date("2026-07-01T09:00:00Z"),
  averageObservedRomDeg: 0,
  perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 0 }],
  symptomSnapshot: { painSelfReport: 6 },
  ...over,
});

describe("세대 판정", () => {
  it("관절별 관찰이 있으면 joint_v1_1 세대다", () => {
    expect(toObservationView(newCapture()).generation).toBe(OBSERVATION_GENERATION.JOINT_V1_1);
    expect(hasJointObservation(newCapture())).toBe(true);
  });

  it("관절별 관찰이 없으면 legacy_rom 세대다", () => {
    expect(toObservationView(legacyCapture()).generation).toBe(OBSERVATION_GENERATION.LEGACY_ROM);
    expect(hasJointObservation(legacyCapture())).toBe(false);
  });

  it("빈 배열은 관절별 관찰이 있는 것으로 보지 않는다", () => {
    expect(hasJointObservation({ perFingerJointObservation: [] })).toBe(false);
  });

  it("capture가 없으면 null을 반환한다", () => {
    expect(toObservationView(null)).toBeNull();
  });
});

describe("신규 필드가 source of truth (§1)", () => {
  it("구형 ROM이 0이어도 신규 관절값을 그대로 노출한다", () => {
    const v = toObservationView(newCapture());
    const f = v.fingers[0];
    expect(f.dipExtensionPoseFlexionDeg).toBe(18.4);
    expect(f.dipActiveRomDeg).toBe(43.7);
    expect(f.pipActiveRomDeg).toBe(76);
  });

  it("legacy 세대에서는 관절 항목을 만들지 않는다(0으로 위장 금지)", () => {
    const f = toObservationView(legacyCapture()).fingers[0];
    expect(f.dipExtensionPoseFlexionDeg).toBeNull();
    expect(f.pipActiveRomDeg).toBeNull();
    expect(f.legacyRomDeg).toBe(0); // 구형 값 자체는 보존
  });

  it("누락값을 0으로 바꾸지 않는다", () => {
    const v = toObservationView(newCapture({
      perFingerJointObservation: [jointFinger({ dipActiveRomDeg: null, pipActiveRomDeg: undefined })],
    }));
    expect(v.fingers[0].dipActiveRomDeg).toBeNull();
    expect(v.fingers[0].pipActiveRomDeg).toBeNull();
  });

  it("실제 0은 0으로 유지한다", () => {
    const v = toObservationView(newCapture({
      perFingerJointObservation: [jointFinger({ dipExtensionPoseFlexionDeg: 0 })],
    }));
    expect(v.fingers[0].dipExtensionPoseFlexionDeg).toBe(0);
  });

  it("handSide·capturedAt·증상을 그대로 전달한다", () => {
    const v = toObservationView(newCapture());
    expect(v.handSide).toBe("left");
    expect(v.symptomSnapshot.painSelfReport).toBe(5);
    expect(v.capturedAt).toBeInstanceOf(Date);
  });
});

describe("외곽 관찰", () => {
  const withContour = newCapture({
    dipContourObservation: {
      measurementVersion: "dip-contour-v1",
      fingers: [{ key: "index", dipWidthRatio: 0.95, contourAsymmetryRatio: 0.02, radialHalfWidthRatio: 0.48, ulnarHalfWidthRatio: 0.46 }],
    },
  });

  it("외곽 관찰이 있으면 손가락에 붙여준다", () => {
    const f = toObservationView(withContour).fingers[0];
    expect(f.contour.dipWidthRatio).toBe(0.95);
    expect(f.contour.contourAsymmetryRatio).toBe(0.02);
  });

  it("외곽 관찰이 없으면 contour는 null이다", () => {
    expect(toObservationView(newCapture()).fingers[0].contour).toBeNull();
  });

  it("한쪽만 외곽 관찰이 있으면 양쪽 비교로 보지 않는다 (§5)", () => {
    expect(hasContourOnBothSides(toObservationView(withContour), toObservationView(newCapture()))).toBe(false);
    expect(hasContourOnBothSides(toObservationView(withContour), toObservationView(withContour))).toBe(true);
  });
});

describe("세대 불일치 (§4)", () => {
  it("legacy 기준선 ↔ 신규 현재는 불일치로 판정한다", () => {
    expect(hasGenerationMismatch(toObservationView(legacyCapture()), toObservationView(newCapture()))).toBe(true);
  });

  it("같은 세대끼리는 불일치가 아니다", () => {
    expect(hasGenerationMismatch(toObservationView(newCapture()), toObservationView(newCapture()))).toBe(false);
    expect(hasGenerationMismatch(toObservationView(legacyCapture()), toObservationView(legacyCapture()))).toBe(false);
  });
});

describe("손가락 짝짓기", () => {
  it("한쪽에만 있는 손가락도 빠뜨리지 않고 없는 쪽은 null이다", () => {
    const base = toObservationView(newCapture());
    const curr = toObservationView(newCapture({
      perFingerJointObservation: [jointFinger({ key: "middle", name: "중지" })],
    }));
    const pairs = pairFingerObservations(base, curr);
    expect(pairs.map((p) => p.key).sort()).toEqual(["index", "middle"]);
    expect(pairs.find((p) => p.key === "index").current).toBeNull();
    expect(pairs.find((p) => p.key === "middle").baseline).toBeNull();
  });
});

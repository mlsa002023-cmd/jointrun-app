import { describe, it, expect } from "vitest";
import { findForbiddenKeys, assertNoForbiddenCaptureKeys } from "./captureSanitize";

describe("captureSanitize (§9·§15E recursive forbidden-key)", () => {
  it("정상 capture payload는 통과한다", () => {
    const ok = {
      schemaVersion: "v1.0",
      poseProtocolVersion: "front-fan-fist-v1",
      perFingerJointObservation: [{ key: "index", dipMaxFlexionDeg: 40, dipActiveRomDeg: 20 }],
      dipContourObservation: { measurementVersion: "dip-contour-v2", fingers: [{ key: "middle", dipWidthRatio: 1.2, contourAsymmetryRatio: 0.05 }] },
      contourObservations: {
        front: { viewType: "front_spread", recordingStatus: "completed", fingers: [{ key: "middle", dipWidthRatio: 1.2, radialHalfWidthRatio: 0.5 }] },
        fanLateral: { viewType: "ok_fan_lateral", recordingStatus: "completed", fingers: [{ key: "ring", sideProfileObserved: true, dipSideProfileRatio: 1.1, sideProfileAsymmetryRatio: 0.04 }] },
      },
      recordingStatus: "completed",
      comparisonQualityStatus: "unverified",
      qualityFlags: [],
    };
    expect(findForbiddenKeys(ok)).toEqual([]);
    expect(() => assertNoForbiddenCaptureKeys(ok)).not.toThrow();
  });

  it("중첩된 displayGeometry를 재귀로 잡는다", () => {
    const bad = {
      contourObservations: { front: { fingers: [{ key: "middle", displayGeometry: { dipCenter: { xNorm: 0.5, yNorm: 0.5 } } }] } },
    };
    const hits = findForbiddenKeys(bad);
    expect(hits.some((h) => h.includes("displayGeometry"))).toBe(true);
    expect(() => assertNoForbiddenCaptureKeys(bad)).toThrow(/저장 금지/);
  });

  it("raw landmark·ImageData·photo·mask·contourPath를 잡는다", () => {
    expect(findForbiddenKeys({ landmarks: [1, 2] }).length).toBe(1);
    expect(findForbiddenKeys({ a: { rawLandmark: [] } }).length).toBe(1);
    expect(findForbiddenKeys({ imageData: {} }).length).toBe(1);
    expect(findForbiddenKeys({ photo: "..." }).length).toBe(1);
    expect(findForbiddenKeys({ segmentationMask: {} }).length).toBe(1);
    expect(findForbiddenKeys({ contourPath: [] }).length).toBe(1);
    expect(findForbiddenKeys({ landmarksRef: null }).length).toBe(1);
  });

  it("좌표 필드(xNorm/yNorm/sideEdgeA/radialEdge)가 배열 안에 있어도 잡는다", () => {
    const bad = { fingers: [{ key: "a" }, { key: "b", sideEdgeA: { xNorm: 1 } }] };
    const hits = findForbiddenKeys(bad);
    expect(hits.some((h) => h.includes("[1].sideEdgeA"))).toBe(true);
  });

  it("정상 관찰 필드명(contourAsymmetryRatio·dipContourObservation·radialHalfWidthRatio)은 오탐하지 않는다", () => {
    expect(findForbiddenKeys({ contourAsymmetryRatio: 0.1, dipContourObservation: {}, radialHalfWidthRatio: 0.5 })).toEqual([]);
  });
});

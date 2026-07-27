// P0-14 §15E — 정면/측면 분리 저장, 버전, 재귀 금지키, 부분 성공(incomplete) 검증(데모 스토어).
import { describe, it, expect, beforeEach } from "vitest";
import {
  createV9Event, saveObservationalAngleCapture, getEventDetail, __resetDemoStoreForTests,
} from "./firestoreV9";
import { findForbiddenKeys } from "./captureSanitize";
import { CAPTURE_PROTOCOL_VERSION, ALGORITHM_VERSION, POSE_PROTOCOL_VERSION, VIEW_TYPE } from "./v9EventTypes";

const uid = "demo-user";
beforeEach(() => __resetDemoStoreForTests());

const frontContour = {
  measurementVersion: "dip-contour-v2",
  fingers: [
    { key: "middle", name: "중지", dipWidthRatio: 1.2, radialHalfWidthRatio: 0.6, ulnarHalfWidthRatio: 0.6, contourAsymmetryRatio: 0.0, validFrames: 9, stabilityMad: 0.02 },
  ],
  qualityFlags: [],
};
const sideProfile = {
  measurementVersion: "dip-contour-v2",
  fingers: [
    { key: "middle", name: "중지", sideProfileObserved: true, dipSideProfileRatio: 1.1, sideProfileAsymmetryRatio: 0.05, sideAHalfProfileRatio: 0.55, sideBHalfProfileRatio: 0.5, validFrames: 8, stabilityMad: 0.03, relativeVariation: 0.03 },
    { key: "ring", name: "약지", sideProfileObserved: false, validFrames: 2 }, // 부분 실패(0으로 채우지 않음)
    { key: "pinky", name: "소지", sideProfileObserved: true, dipSideProfileRatio: 1.05, sideProfileAsymmetryRatio: 0.04, sideAHalfProfileRatio: 0.52, sideBHalfProfileRatio: 0.5, validFrames: 8, stabilityMad: 0.02, relativeVariation: 0.02 },
  ],
  qualityFlags: [],
};

async function save(extra = {}) {
  const eventId = await createV9Event(uid, { primaryTrigger: "pain_stiffness", secondaryTriggers: [] });
  const captureId = await saveObservationalAngleCapture(uid, eventId, {
    handSide: "right",
    perFingerJointObservation: [{ key: "middle", name: "중지", dipMaxFlexionDeg: 55, dipActiveRomDeg: 30, dipObserved: true }],
    deviationDirection: "neutral",
    dipContourObservation: frontContour,
    sideProfileObservation: sideProfile,
    perFingerObservedRomDeg: [{ key: "middle", name: "중지", romDeg: 100 }],
    averageObservedRomDeg: 100,
    qualityFlags: [],
    ...extra,
  });
  const detail = await getEventDetail(uid, eventId);
  return detail.captures.find((c) => c.id === captureId);
}

describe("P0-14 저장 스키마 (§9·§10·§12)", () => {
  it("정면·측면이 contourObservations.front / .fanLateral로 분리 저장된다", async () => {
    const cap = await save();
    expect(cap.contourObservations.front.viewType).toBe(VIEW_TYPE.FRONT_SPREAD);
    expect(cap.contourObservations.fanLateral.viewType).toBe(VIEW_TYPE.OK_FAN_LATERAL);
    expect(cap.contourObservations.front.fingers[0].key).toBe("middle");
    expect(cap.contourObservations.fanLateral.fingers.map((f) => f.key)).toEqual(["middle", "ring", "pinky"]);
  });

  it("버전이 P0-14 값으로 스탬프된다", async () => {
    const cap = await save();
    expect(cap.poseProtocolVersion).toBe(POSE_PROTOCOL_VERSION);
    expect(cap.captureProtocolVersion).toBe(CAPTURE_PROTOCOL_VERSION);
    expect(cap.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(cap.poseProtocolVersion).toBe("front-fan-fist-v1");
  });

  it("측면 실패 손가락은 sideProfileObserved:false로 남고 0으로 채워지지 않는다", async () => {
    const cap = await save();
    const ring = cap.contourObservations.fanLateral.fingers.find((f) => f.key === "ring");
    expect(ring.sideProfileObserved).toBe(false);
    expect(ring.dipSideProfileRatio).toBeUndefined();
  });

  it("부분 성공이면 fanLateral.recordingStatus를 incomplete로 저장할 수 있다", async () => {
    const cap = await save({ fanRecordingStatus: "incomplete", recordingStatus: "incomplete" });
    expect(cap.contourObservations.fanLateral.recordingStatus).toBe("incomplete");
    expect(cap.recordingStatus).toBe("incomplete");
  });

  it("저장된 capture 전체에 금지 키(사진·landmark·displayGeometry·좌표)가 재귀적으로 없다", async () => {
    const cap = await save();
    expect(findForbiddenKeys(cap)).toEqual([]);
  });

  it("dipContourObservation(호환 필드)도 함께 유지되어 구형 리더가 계속 읽는다", async () => {
    const cap = await save();
    expect(cap.dipContourObservation.fingers[0].dipWidthRatio).toBe(1.2);
  });
});

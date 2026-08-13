import { describe, it, expect } from "vitest";
import {
  evaluatePoseFrame, computeViewAngleFromFrontDeg, meanFingerCurlRatio,
  COACH_CODE, POSES, poseById, coachMessageFor,
} from "./poseProtocol";
import { VIEW_TYPE } from "./v9EventTypes";

// 21-point landmark 배열을 만든다. overrides는 { index: {x,y,z} } 형태.
function lm(overrides = {}) {
  const arr = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  Object.entries(overrides).forEach(([i, p]) => { arr[Number(i)] = { x: 0, y: 0, z: 0, ...p }; });
  return arr;
}
// tip이 프레임 안(0.5)인 기본 image landmark. overrides로 특정 tip을 화면 밖으로 뺀다.
function img(overrides = {}) {
  const arr = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  Object.entries(overrides).forEach(([i, p]) => { arr[Number(i)] = { x: 0.5, y: 0.5, z: 0, ...p }; });
  return arr;
}

// 정면 손: palm plane = xy, palmNormal ≈ z, viewAngle ≈ 0.
function frontHand() {
  return lm({
    0: { x: 0, y: 0, z: 0 },     // wrist
    5: { x: 1, y: 2, z: 0 },     // index mcp
    9: { x: 0, y: 2, z: 0 },     // middle mcp (handScale=2)
    13: { x: -0.5, y: 2, z: 0 }, // ring mcp
    17: { x: -1, y: 2, z: 0 },   // pinky mcp
    8: { x: 1.5, y: 4, z: 0 },   // index tip
    12: { x: 0.5, y: 4.2, z: 0 },// middle tip
    16: { x: -0.5, y: 4.2, z: 0 },// ring tip
    20: { x: -1.5, y: 4, z: 0 }, // pinky tip
    4: { x: 2, y: 3, z: 0 },     // thumb tip
  });
}

// 측면 손: palm plane = yz, palmNormal ≈ x, viewAngle ≈ 90. 엄지·검지 접촉 + 부채꼴.
function lateralHand() {
  return lm({
    0: { x: 0, y: 0, z: 0 },
    5: { x: 0, y: 2, z: 1 },
    9: { x: 0, y: 2, z: 0 },     // handScale=2
    13: { x: 0, y: 2, z: -0.5 },
    17: { x: 0, y: 2, z: -1 },
    8: { x: 0, y: 4, z: 1 },     // index tip
    4: { x: 0, y: 4, z: 1.2 },   // thumb tip (검지 tip에 근접 → contact)
    12: { x: 0, y: 4, z: 0.3 },  // middle tip
    16: { x: 0, y: 4, z: -0.3 }, // ring tip
    20: { x: 0, y: 4, z: -0.9 }, // pinky tip
  });
}

// 굽힘 손: tip이 MCP에 근접(curl 낮음).
function fistHand() {
  return lm({
    0: { x: 0, y: 0, z: 0 },
    5: { x: 1, y: 2, z: 0 }, 8: { x: 1, y: 2.6, z: 0 },
    9: { x: 0, y: 2, z: 0 }, 12: { x: 0, y: 2.6, z: 0 },
    13: { x: -0.5, y: 2, z: 0 }, 16: { x: -0.5, y: 2.6, z: 0 },
    17: { x: -1, y: 2, z: 0 }, 20: { x: -1, y: 2.6, z: 0 },
    4: { x: 1.5, y: 2.3, z: 0 },
  });
}

describe("computeViewAngleFromFrontDeg", () => {
  it("정면 손은 0°에 가깝다", () => {
    expect(computeViewAngleFromFrontDeg(frontHand())).toBeLessThan(10);
  });
  it("측면 손은 90°에 가깝다", () => {
    expect(computeViewAngleFromFrontDeg(lateralHand())).toBeGreaterThan(80);
  });
  it("landmark가 없으면 null", () => {
    expect(computeViewAngleFromFrontDeg(null)).toBeNull();
    expect(computeViewAngleFromFrontDeg(lm({}))).not.toBeNaN();
  });
  it("abs()를 써서 손 좌우(부호)에 영향받지 않는다", () => {
    const flipped = lateralHand().map((p) => ({ ...p, z: -p.z }));
    expect(computeViewAngleFromFrontDeg(flipped)).toBeGreaterThan(80);
  });
});

describe("evaluatePoseFrame — front_spread (§4)", () => {
  const base = { poseId: VIEW_TYPE.FRONT_SPREAD };
  it("정면·벌림·프레임 안 → valid, HOLD_STEADY", () => {
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: frontHand() });
    expect(r.valid).toBe(true);
    expect(r.coachCode).toBe(COACH_CODE.HOLD_STEADY);
  });
  it("회전된 손(측면) → FACE_CAMERA 교정", () => {
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: lateralHand() });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.FACE_CAMERA);
  });
  it("손가락이 붙어 있으면 → SPREAD_FINGERS 교정", () => {
    const together = frontHand();
    together[8] = { x: 0.1, y: 4, z: 0 };
    together[12] = { x: 0.0, y: 4, z: 0 };
    together[16] = { x: -0.1, y: 4, z: 0 };
    together[20] = { x: -0.2, y: 4, z: 0 };
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: together });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.SPREAD_FINGERS);
  });
  it("손이 화면 밖 → MOVE_INTO_FRAME 교정", () => {
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img({ 8: { x: 0.995 } }), worldLandmarks: frontHand() });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.MOVE_INTO_FRAME);
  });
  it("신전 제한이 있어도(남은 굽힘) 벌리기만 하면 valid — 완전 신전을 요구하지 않는다", () => {
    // frontHand는 완전 신전이 아니어도 valid여야 한다(각도 임계값 없음).
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: frontHand() });
    expect(r.valid).toBe(true);
  });
  it("contourMeasurement의 손가락별 ok를 perFingerValidity로 전달한다(부분 성공)", () => {
    const contour = [
      { key: "index", ok: true }, { key: "middle", ok: false },
      { key: "ring", ok: true }, { key: "pinky", ok: true },
    ];
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: frontHand(), contourMeasurement: contour });
    expect(r.perFingerValidity).toEqual({ index: true, middle: false, ring: true, pinky: true });
  });
});

describe("evaluatePoseFrame — ok_fan_lateral (§5)", () => {
  const base = { poseId: VIEW_TYPE.OK_FAN_LATERAL };
  it("측면·엄지검지 접촉·부채꼴 → valid, SIDE_VISIBLE_HOLD", () => {
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: lateralHand() });
    expect(r.valid).toBe(true);
    expect(r.coachCode).toBe(COACH_CODE.SIDE_VISIBLE_HOLD);
  });
  it("정면이라 측면 부족 → ROTATE_TO_SIDE (엄지검지 거리만으로 성공 처리하지 않음)", () => {
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: frontHand() });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.ROTATE_TO_SIDE);
  });
  it("측면이지만 엄지·검지가 떨어져 있으면 → THUMB_INDEX_TOUCH", () => {
    const h = lateralHand();
    h[4] = { x: 0, y: 6, z: 3 }; // 엄지 tip을 멀리
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: h });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.THUMB_INDEX_TOUCH);
  });
  it("중지·약지·소지가 겹치면(부채꼴 아님) → FAN_FINGERS", () => {
    const h = lateralHand();
    h[12] = { x: 0, y: 4, z: 0.05 };
    h[16] = { x: 0, y: 4, z: 0.0 };
    h[20] = { x: 0, y: 4, z: -0.05 };
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: h });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.FAN_FINGERS);
  });
  it("perFingerValidity는 중지·약지·소지만 다룬다(검지는 필수 아님)", () => {
    const contour = [
      { key: "middle", ok: true }, { key: "ring", ok: true }, { key: "pinky", ok: false },
    ];
    const r = evaluatePoseFrame({ ...base, imageLandmarks: img(), worldLandmarks: lateralHand(), contourMeasurement: contour });
    expect(Object.keys(r.perFingerValidity).sort()).toEqual(["middle", "pinky", "ring"]);
    expect(r.perFingerValidity.pinky).toBe(false);
  });
});

describe("evaluatePoseFrame — max_comfortable_fist (§7)", () => {
  const base = { poseId: VIEW_TYPE.MAX_COMFORTABLE_FIST };
  it("spread 대비 실제로 쥐면 valid (작은 ROM도 허용)", () => {
    const spreadCurlRatio = meanFingerCurlRatio(frontHand());
    const r = evaluatePoseFrame({
      ...base, imageLandmarks: img(), worldLandmarks: fistHand(),
      previousPoseData: { spreadCurlRatio },
    });
    expect(r.valid).toBe(true);
  });
  it("spread와 동일해 굽힘 변화가 없으면 → CURL_MORE (정상범위 임계값 없이 '변화'만 본다)", () => {
    const spreadCurlRatio = meanFingerCurlRatio(frontHand());
    const r = evaluatePoseFrame({
      ...base, imageLandmarks: img(), worldLandmarks: frontHand(),
      previousPoseData: { spreadCurlRatio },
    });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.CURL_MORE);
  });
  it("손이 화면 밖이면 → MOVE_INTO_FRAME", () => {
    const r = evaluatePoseFrame({
      ...base, imageLandmarks: img({ 12: { y: 0.995 } }), worldLandmarks: fistHand(),
      previousPoseData: { spreadCurlRatio: 1.5 },
    });
    expect(r.valid).toBe(false);
    expect(r.coachCode).toBe(COACH_CODE.MOVE_INTO_FRAME);
  });
});

describe("POSES 정의 (§1 3개 유지, OK 제거 안 함)", () => {
  it("정확히 3개, 순서·viewType 확정", () => {
    expect(POSES.map((p) => p.id)).toEqual([
      VIEW_TYPE.FRONT_SPREAD, VIEW_TYPE.OK_FAN_LATERAL, VIEW_TYPE.MAX_COMFORTABLE_FIST,
    ]);
  });
  it("fist는 캘리퍼를 표시하지 않는다(§8)", () => {
    expect(poseById(VIEW_TYPE.MAX_COMFORTABLE_FIST).showsCaliper).toBe(false);
  });
  it("측면 안내에 안전 문구가 있고, 문구에 '정밀 조절력'이 없다(§5 삭제 확인)", () => {
    const fan = poseById(VIEW_TYPE.OK_FAN_LATERAL);
    expect(fan.safetyNote).toContain("세게 누르지");
    const allCopy = POSES.flatMap((p) => [p.title, p.mainGuide, p.subGuide, p.holdMessage]).join(" ");
    expect(allCopy).not.toMatch(/정밀 조절력|OK 사인|가볍게 쥐기/);
  });
  it("모든 coachCode에 문구가 정의돼 있다", () => {
    Object.values(COACH_CODE).forEach((c) => expect(coachMessageFor(c)).toBeTruthy());
  });
});

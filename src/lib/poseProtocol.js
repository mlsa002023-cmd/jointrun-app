// ─────────────────────────────────────────────
// poseProtocol — P0-14 3-포즈 관찰 프로토콜 (정면·측면·굽힘)
//
// 이 모듈은 "이번 프레임에서 자세가 올바른가"만 판정하는 순수 함수다.
// React·카메라·DOM·저장에 접근하지 않는다. 상태 전이(aligning→holding→confirmed)는
// poseHoldMachine.js가, 실제 외곽 수치는 dipContour.js가 담당한다.
//
// 세 동작:
//   1. front_spread          정면 관절·외곽 관찰
//   2. ok_fan_lateral        OK 부채꼴 측면 외곽 관찰(기존 "정밀 조절력" 목적 제거)
//   3. max_comfortable_fist  개인이 가능한 범위의 굽힘 관찰
//
// 원칙(§1·§3·§4·§5·§7):
//   - 정상 신전/정상 굴곡 "임계값"으로 사용자를 실패시키지 않는다. 남은 굽힘은 관찰값이다.
//   - view angle은 QA·자세 판정용일 뿐 임상 촬영각이 아니다. handedness/부호 영향을 없애려 abs()를 쓴다.
//   - 잘못된 자세를 "시간이 지났다"는 이유로 통과시키지 않는다(자동 승인은 상태머신이 막는다).
//   - 한 번에 하나의 교정 문구만 낸다(우선순위 순).
// ─────────────────────────────────────────────

import { VIEW_TYPE, POSE_PROTOCOL_VERSION } from "./v9EventTypes";

export { POSE_PROTOCOL_VERSION };

// MediaPipe Hands 21-point 인덱스.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;
const FINGER_TIPS = { index: 8, middle: 12, ring: 16, pinky: 20 };
const FINGER_MCPS = { index: 5, middle: 9, ring: 13, pinky: 17 };
const FAN_FINGERS = ["middle", "ring", "pinky"]; // 검지는 엄지 접촉으로 가릴 수 있어 부채꼴 판정에서 제외

// 교정/상태 코드 — 분석 이벤트(coachCode)와 테스트에서 문자열 대신 이 코드로 참조한다.
export const COACH_CODE = {
  HOLD_STEADY: "hold_steady",
  FACE_CAMERA: "face_camera",
  SPREAD_FINGERS: "spread_fingers",
  MOVE_INTO_FRAME: "move_into_frame",
  ROTATE_TO_SIDE: "rotate_to_side",
  THUMB_INDEX_TOUCH: "thumb_index_touch",
  FAN_FINGERS: "fan_fingers",
  SEPARATE_FINGERS: "separate_fingers",
  SIDE_VISIBLE_HOLD: "side_visible_hold",
  CURL_MORE: "curl_more",
  KEEP_WRIST_STILL: "keep_wrist_still",
  SHOW_HAND: "show_hand",
};

const COACH_MESSAGE = {
  [COACH_CODE.HOLD_STEADY]: "좋아요. 그 자세에서 잠시 멈춰 주세요.",
  [COACH_CODE.FACE_CAMERA]: "손등이 카메라를 향하도록 조금 돌려 주세요.",
  [COACH_CODE.SPREAD_FINGERS]: "손가락 사이를 조금 더 벌려 주세요.",
  [COACH_CODE.MOVE_INTO_FRAME]: "손 전체를 화면 안쪽으로 이동해 주세요.",
  [COACH_CODE.ROTATE_TO_SIDE]: "손날이 바닥에 닿도록 조금 더 옆으로 돌려 주세요.",
  [COACH_CODE.THUMB_INDEX_TOUCH]: "엄지와 검지는 힘을 빼고 가볍게 맞대 주세요.",
  [COACH_CODE.FAN_FINGERS]: "중지·약지·소지를 부채처럼 벌려 주세요.",
  [COACH_CODE.SEPARATE_FINGERS]: "손가락이 겹치지 않도록 간격을 만들어 주세요.",
  [COACH_CODE.SIDE_VISIBLE_HOLD]: "측면이 잘 보여요. 그대로 유지해 주세요.",
  [COACH_CODE.CURL_MORE]: "손가락을 가능한 만큼 조금 더 쥐어 주세요.",
  [COACH_CODE.KEEP_WRIST_STILL]: "손목은 그대로 두고 손가락만 움직여 주세요.",
  [COACH_CODE.SHOW_HAND]: "카메라 앞에 손을 다시 비춰 주세요.",
};

export function coachMessageFor(code) {
  return COACH_MESSAGE[code] ?? null;
}

// 임계값은 전부 여기 모은다(§5 "임계값은 config에 분리"). iPhone 실기기 검증 후 조정한다.
export const POSE_CONFIG = {
  // view angle(정면=0°, 완전 측면=90°) 경계.
  frontMaxViewAngleDeg: 38, // 이 값보다 작아야 "정면"으로 본다
  lateralMinViewAngleDeg: 42, // 이 값보다 커야 "측면/사선"으로 본다
  // 손가락 벌림 — 인접 지문 간 거리 / handScale.
  frontMinTipSeparation: 0.16,
  fanMinTipSeparation: 0.14,
  // OK 접촉 — |thumbTip - indexTip| / handScale.
  okContactMaxRatio: 0.5,
  // 프레임 밖 여백(정규화 좌표).
  frameEdgeMargin: 0.02,
  // 굽힘 감지 — fist의 평균 tip→MCP 거리가 spread 기준 대비 이 비율 이상 줄어야 "쥠"으로 본다.
  fistMinCurlDrop: 0.08,
  // 손목 안정 — fist에서 wrist가 handScale 대비 이만큼 이상 흔들리면 과도 이동.
  wristMaxDriftRatio: 0.5,
};

// ── 순수 벡터 헬퍼(3D world landmark용). 기존 모듈들과 달리 이 파일은 독립 순수 모듈이라
//    자체 헬퍼를 둔다(§3 "비즈니스 로직은 별도 순수 모듈로"). ──
function pt(lms, i) {
  const p = lms?.[i];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: p.x, y: p.y, z: Number.isFinite(p.z) ? p.z : 0 };
}
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function len(a) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a) { const l = len(a); return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : null; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/**
 * 손바닥 정면으로부터의 view angle(도). 0°=정면(손등이 카메라), 90°=완전 측면.
 * palmNormal = normalize(cross(indexMcp - wrist, pinkyMcp - wrist)).
 * handedness와 normal 부호 영향을 없애기 위해 abs(dot)을 쓴다(§5).
 * @returns {number|null} 계산 불가 시 null.
 */
export function computeViewAngleFromFrontDeg(worldLandmarks) {
  const wrist = pt(worldLandmarks, WRIST);
  const idx = pt(worldLandmarks, INDEX_MCP);
  const pinky = pt(worldLandmarks, PINKY_MCP);
  if (!wrist || !idx || !pinky) return null;
  const palmNormal = normalize(cross(sub(idx, wrist), sub(pinky, wrist)));
  if (!palmNormal) return null;
  const cameraAxis = { x: 0, y: 0, z: 1 };
  return (Math.acos(clamp(Math.abs(dot(palmNormal, cameraAxis)), 0, 1)) * 180) / Math.PI;
}

function handScaleOf(worldLandmarks) {
  const wrist = pt(worldLandmarks, WRIST);
  const midMcp = pt(worldLandmarks, MIDDLE_MCP);
  if (!wrist || !midMcp) return null;
  const s = len(sub(midMcp, wrist));
  return s > 1e-6 ? s : null;
}

/** 각 손가락 tip이 프레임(정규화 0..1) 안에 있는지 — 하나라도 벗어나면 out_of_frame. */
function anyTipOutOfFrame(imageLandmarks, keys) {
  const m = POSE_CONFIG.frameEdgeMargin;
  return keys.some((k) => {
    const p = pt(imageLandmarks, FINGER_TIPS[k]);
    if (!p) return false; // 없는 건 여기서 판정하지 않음(landmark 유효성은 별도)
    return p.x < m || p.y < m || p.x > 1 - m || p.y > 1 - m;
  });
}

/** 인접 손가락 tip 간 최소 분리(handScale 대비 정규화 2D). */
function minAdjacentTipSeparation(worldLandmarks, keys) {
  const scale = handScaleOf(worldLandmarks);
  if (!scale) return null;
  let min = Infinity;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = pt(worldLandmarks, FINGER_TIPS[keys[i]]);
    const b = pt(worldLandmarks, FINGER_TIPS[keys[i + 1]]);
    if (!a || !b) return null;
    min = Math.min(min, len(sub(a, b)) / scale);
  }
  return Number.isFinite(min) ? min : null;
}

function thumbIndexContactRatio(worldLandmarks) {
  const scale = handScaleOf(worldLandmarks);
  const thumb = pt(worldLandmarks, THUMB_TIP);
  const index = pt(worldLandmarks, FINGER_TIPS.index);
  if (!scale || !thumb || !index) return null;
  return len(sub(thumb, index)) / scale;
}

/** 평균 tip→MCP 거리 / handScale — 굽힘(작을수록 굽음)의 대략적 지표. */
export function meanFingerCurlRatio(worldLandmarks, keys = ["index", "middle", "ring", "pinky"]) {
  const scale = handScaleOf(worldLandmarks);
  if (!scale) return null;
  const vals = [];
  keys.forEach((k) => {
    const tip = pt(worldLandmarks, FINGER_TIPS[k]);
    const mcp = pt(worldLandmarks, FINGER_MCPS[k]);
    if (tip && mcp) vals.push(len(sub(tip, mcp)) / scale);
  });
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

const EMPTY_RESULT = (coachCode, flags = []) => ({
  valid: false,
  coachCode,
  coachMessage: coachMessageFor(coachCode),
  globalQualityFlags: flags,
  perFingerValidity: {},
  viewMetrics: {},
});

// contourMeasurement(측면/정면 프레임 관찰)에서 손가락별 ok 여부를 뽑는다.
function perFingerValidityFrom(contourMeasurement, keys) {
  const out = {};
  keys.forEach((k) => {
    const m = Array.isArray(contourMeasurement) ? contourMeasurement.find((c) => c.key === k) : null;
    out[k] = Boolean(m?.ok);
  });
  return out;
}

// ── 1단계: front_spread ──
function evaluateFrontSpread({ imageLandmarks, worldLandmarks, contourMeasurement }) {
  if (!worldLandmarks || !pt(worldLandmarks, WRIST)) return EMPTY_RESULT(COACH_CODE.SHOW_HAND);

  const viewAngle = computeViewAngleFromFrontDeg(worldLandmarks);
  const separation = minAdjacentTipSeparation(worldLandmarks, ["index", "middle", "ring", "pinky"]);
  const outOfFrame = anyTipOutOfFrame(imageLandmarks, ["index", "middle", "ring", "pinky"]);
  const perFingerValidity = perFingerValidityFrom(contourMeasurement, ["index", "middle", "ring", "pinky"]);
  const viewMetrics = { viewAngleFromFrontDeg: viewAngle, tipSeparation: separation };

  // 우선순위: 정면 아님 → 벌림 부족 → 프레임 밖 → 통과.
  if (viewAngle == null) return { ...EMPTY_RESULT(COACH_CODE.FACE_CAMERA), viewMetrics };
  if (viewAngle > POSE_CONFIG.frontMaxViewAngleDeg) return { ...EMPTY_RESULT(COACH_CODE.FACE_CAMERA), viewMetrics, perFingerValidity };
  if (separation == null || separation < POSE_CONFIG.frontMinTipSeparation)
    return { ...EMPTY_RESULT(COACH_CODE.SPREAD_FINGERS), viewMetrics, perFingerValidity };
  if (outOfFrame) return { ...EMPTY_RESULT(COACH_CODE.MOVE_INTO_FRAME), viewMetrics, perFingerValidity };

  return {
    valid: true,
    coachCode: COACH_CODE.HOLD_STEADY,
    coachMessage: coachMessageFor(COACH_CODE.HOLD_STEADY),
    globalQualityFlags: [],
    perFingerValidity,
    viewMetrics,
  };
}

// ── 2단계: ok_fan_lateral ──
function evaluateOkFanLateral({ imageLandmarks, worldLandmarks, contourMeasurement }) {
  if (!worldLandmarks || !pt(worldLandmarks, WRIST)) return EMPTY_RESULT(COACH_CODE.SHOW_HAND);

  const viewAngle = computeViewAngleFromFrontDeg(worldLandmarks);
  const contact = thumbIndexContactRatio(worldLandmarks);
  const fanSep = minAdjacentTipSeparation(worldLandmarks, FAN_FINGERS);
  const outOfFrame = anyTipOutOfFrame(imageLandmarks, ["middle", "ring", "pinky"]);
  const perFingerValidity = perFingerValidityFrom(contourMeasurement, FAN_FINGERS);
  const viewMetrics = { viewAngleFromFrontDeg: viewAngle, thumbIndexContactRatio: contact, fanSeparation: fanSep };

  // 우선순위: 측면 부족 → 엄지·검지 접촉 → 부채꼴 분리 → 프레임 밖 → 통과.
  // "엄지 tip과 검지 tip이 가깝다"는 것만으로 성공 처리하지 않는다(§5) — 측면·부채꼴 조건을 함께 본다.
  if (viewAngle == null) return { ...EMPTY_RESULT(COACH_CODE.ROTATE_TO_SIDE), viewMetrics };
  if (viewAngle < POSE_CONFIG.lateralMinViewAngleDeg)
    return { ...EMPTY_RESULT(COACH_CODE.ROTATE_TO_SIDE), viewMetrics, perFingerValidity };
  if (contact == null || contact > POSE_CONFIG.okContactMaxRatio)
    return { ...EMPTY_RESULT(COACH_CODE.THUMB_INDEX_TOUCH), viewMetrics, perFingerValidity };
  if (fanSep == null || fanSep < POSE_CONFIG.fanMinTipSeparation)
    return { ...EMPTY_RESULT(COACH_CODE.FAN_FINGERS), viewMetrics, perFingerValidity };
  if (outOfFrame) return { ...EMPTY_RESULT(COACH_CODE.MOVE_INTO_FRAME), viewMetrics, perFingerValidity };

  return {
    valid: true,
    coachCode: COACH_CODE.SIDE_VISIBLE_HOLD,
    coachMessage: coachMessageFor(COACH_CODE.SIDE_VISIBLE_HOLD),
    globalQualityFlags: [],
    perFingerValidity,
    viewMetrics,
  };
}

// ── 3단계: max_comfortable_fist ──
function evaluateMaxComfortableFist({ imageLandmarks, worldLandmarks, previousPoseData }) {
  if (!worldLandmarks || !pt(worldLandmarks, WRIST)) return EMPTY_RESULT(COACH_CODE.SHOW_HAND);

  const curl = meanFingerCurlRatio(worldLandmarks);
  const spreadCurl = previousPoseData?.spreadCurlRatio ?? null;
  const outOfFrame = anyTipOutOfFrame(imageLandmarks, ["index", "middle", "ring", "pinky"]);
  const viewMetrics = { curlRatio: curl, spreadCurlRatio: spreadCurl };

  if (curl == null) return { ...EMPTY_RESULT(COACH_CODE.SHOW_HAND), viewMetrics };
  if (outOfFrame) return { ...EMPTY_RESULT(COACH_CODE.MOVE_INTO_FRAME), viewMetrics };

  // 굽힘 감지: spread 기준값이 있으면 그 대비 실제 감소를, 없으면 절대 curl 비율로 대략 판정한다.
  // 정상 범위 임계값은 쓰지 않는다(§7) — "spread보다 실제로 더 쥐었는가"만 본다. 작은 ROM도 유효.
  const curled =
    spreadCurl != null
      ? curl <= spreadCurl - POSE_CONFIG.fistMinCurlDrop
      : curl < 0.95; // 기준값이 없을 때의 느슨한 안전망(완전히 편 손만 배제)
  if (!curled) return { ...EMPTY_RESULT(COACH_CODE.CURL_MORE), viewMetrics };

  return {
    valid: true,
    coachCode: COACH_CODE.HOLD_STEADY,
    coachMessage: coachMessageFor(COACH_CODE.HOLD_STEADY),
    globalQualityFlags: [],
    perFingerValidity: {},
    viewMetrics,
  };
}

/**
 * 한 프레임의 자세 판정(순수 함수). 상태 전이·집계는 하지 않는다.
 * @param {object} args
 * @param {string} args.poseId  VIEW_TYPE 값
 * @param {Array}  args.imageLandmarks  정규화 2D landmark(프레임 안 판정용)
 * @param {Array}  args.worldLandmarks  metric 3D landmark(각도·자세 판정용)
 * @param {Array}  [args.contourMeasurement]  이 프레임의 손가락별 외곽 관찰(ok 플래그 포함)
 * @param {object} [args.previousPoseData]  이전 포즈 파생값(예: front spread의 curlRatio)
 * @returns {{valid:boolean, coachCode:string, coachMessage:string,
 *            globalQualityFlags:string[], perFingerValidity:object, viewMetrics:object}}
 */
export function evaluatePoseFrame({ poseId, imageLandmarks, worldLandmarks, contourMeasurement, previousPoseData }) {
  switch (poseId) {
    case VIEW_TYPE.FRONT_SPREAD:
      return evaluateFrontSpread({ imageLandmarks, worldLandmarks, contourMeasurement });
    case VIEW_TYPE.OK_FAN_LATERAL:
      return evaluateOkFanLateral({ imageLandmarks, worldLandmarks, contourMeasurement });
    case VIEW_TYPE.MAX_COMFORTABLE_FIST:
      return evaluateMaxComfortableFist({ imageLandmarks, worldLandmarks, previousPoseData });
    default:
      return EMPTY_RESULT(COACH_CODE.SHOW_HAND);
  }
}

// ── 포즈 순서와 화면 문구(§4·§5·§7) ──
export const POSES = [
  {
    id: VIEW_TYPE.FRONT_SPREAD,
    viewType: VIEW_TYPE.FRONT_SPREAD,
    title: "손가락 정면 관찰",
    mainGuide: "손등을 카메라로 향하고 손가락을 가능한 만큼 펴 주세요.",
    subGuide: "손가락끼리 닿지 않게 벌리고, 손바닥과 손목을 바닥에 가볍게 놓아 주세요.",
    holdMessage: "좋아요. 그대로 잠시 유지해 주세요.",
    safetyNote: null,
    measuresContour: "front",
    showsCaliper: true,
  },
  {
    id: VIEW_TYPE.OK_FAN_LATERAL,
    viewType: VIEW_TYPE.OK_FAN_LATERAL,
    title: "끝마디 측면 관찰",
    mainGuide: "새끼손가락 쪽 손날을 바닥에 가볍게 대고, 엄지와 검지를 힘주지 말고 맞대 주세요.",
    subGuide: "중지·약지·소지는 서로 겹치지 않게 부채처럼 벌려 주세요.",
    holdMessage: "측면이 잘 보여요. 그대로 잠시 유지해 주세요.",
    safetyNote: "손가락이나 관절을 바닥에 세게 누르지 마세요.",
    measuresContour: "fanLateral",
    showsCaliper: true,
  },
  {
    id: VIEW_TYPE.MAX_COMFORTABLE_FIST,
    viewType: VIEW_TYPE.MAX_COMFORTABLE_FIST,
    title: "손가락 굽힘 관찰",
    mainGuide: "통증이 심해지지 않는 범위에서 손가락을 가능한 만큼 천천히 쥐어 주세요.",
    subGuide: "손목은 그대로 두고 손가락만 움직여 주세요.",
    holdMessage: "좋아요. 가능한 자세에서 잠시 유지해 주세요.",
    safetyNote: null,
    measuresContour: null, // §7 — 외곽 캘리퍼 미표시, 측면값 계산 금지
    showsCaliper: false,
  },
];

export function poseById(id) {
  return POSES.find((p) => p.id === id) ?? null;
}

// fan 자동 완료에 필요한 최소 유효 손가락 수(§5).
export const FAN_MIN_VALID_FINGERS = 2;
export { FAN_FINGERS };

// ─────────────────────────────────────────────
// MeasurementQuality — 측정 성공 판정 (RC1.2.2 P0-8 §7)
//
// 핵심 원칙: 성공 여부를 "각도가 얼마나 큰가"로 판정하지 않는다.
// 변형이 심해 ROM이 작거나 다 폈는데도 굴곡이 남아 있는 손은 정상적인 관찰 대상이지
// 측정 실패가 아니다. 실패는 "각도를 신뢰할 수 없는 경우"에만 선언한다.
//
// 판정 재료:
//   - 유효 landmark 수
//   - 포즈별 프레임 안정성(동일 포즈 내 값 분산)
//   - 관절 벡터 길이 (jointObservation.analyzeJoint에서 검사 → valid 플래그로 전달)
//   - NaN/Infinity 여부
//   - 실제 좌표 변화 (센서가 0도로 굳어버린 경우 검출)
// ─────────────────────────────────────────────

import { FINGER_CHAINS, WRIST, INDEX_MCP, PINKY_MCP } from "./jointObservation";

/** 손 하나를 관찰하는 데 반드시 좌표가 있어야 하는 landmark 인덱스. */
export const REQUIRED_LANDMARKS = [
  WRIST, INDEX_MCP, PINKY_MCP,
  ...Object.values(FINGER_CHAINS).flatMap((c) => [c.mcp, c.pip, c.dip, c.tip]),
];

export const QUALITY_FLAG = {
  LANDMARKS_MISSING: "landmarks_missing",
  NON_FINITE: "non_finite_values",
  FRAMES_INSUFFICIENT: "frames_insufficient",
  UNSTABLE_POSE: "unstable_pose",
  NO_COORDINATE_CHANGE: "no_coordinate_change",
  JOINT_UNRESOLVED: "joint_unresolved",
  TIP_OCCLUDED: "tip_occluded",
};

// 한 포즈를 대표값으로 요약하는 데 필요한 최소 프레임 수.
const MIN_FRAMES = 3;
// 같은 포즈 안에서 이 정도까지 흔들리면 자세가 고정되지 않은 것으로 본다(각도 크기와 무관).
const MAX_STABLE_SPREAD_DEG = 18;
// 프레임 사이 좌표가 이 비율만큼도 변하지 않으면 센서가 굳은 것으로 본다(손 크기 대비).
const MIN_COORDINATE_CHANGE_RATIO = 1e-4;

function isFinitePoint(p) {
  return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

/** 한 프레임의 landmark가 관찰에 쓸 수 있는 상태인지 확인한다. */
export function inspectFrameLandmarks(lm) {
  if (!Array.isArray(lm) && !lm) return { usable: false, presentCount: 0, missing: REQUIRED_LANDMARKS };
  const missing = REQUIRED_LANDMARKS.filter((i) => !isFinitePoint(lm[i]));
  return {
    usable: missing.length === 0,
    presentCount: REQUIRED_LANDMARKS.length - missing.length,
    requiredCount: REQUIRED_LANDMARKS.length,
    missing,
  };
}

/**
 * 프레임 사이에 좌표가 실제로 변했는지 확인한다.
 * 완전히 동일한 값만 반복되면 카메라/추정기가 멈춘 것이므로 관찰로 인정하지 않는다.
 * (§7 "센서 0도 오류", "실제 좌표 변화")
 */
export function hasCoordinateChange(frames) {
  const usable = frames.filter((f) => f && isFinitePoint(f[WRIST]) && isFinitePoint(f[INDEX_MCP]));
  if (usable.length < 2) return false;

  const scaleRef = usable[0];
  const handScale = Math.hypot(
    scaleRef[INDEX_MCP].x - scaleRef[WRIST].x,
    scaleRef[INDEX_MCP].y - scaleRef[WRIST].y,
    scaleRef[INDEX_MCP].z - scaleRef[WRIST].z
  ) || 1;

  const threshold = handScale * MIN_COORDINATE_CHANGE_RATIO;
  const probeIdx = Object.values(FINGER_CHAINS).map((c) => c.tip);

  for (let i = 1; i < usable.length; i += 1) {
    for (const idx of probeIdx) {
      const a = usable[i - 1][idx];
      const b = usable[i][idx];
      if (!isFinitePoint(a) || !isFinitePoint(b)) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > threshold) return true;
    }
  }
  return false;
}

/**
 * 한 포즈(spread/fist 등)의 프레임 묶음이 측정으로 성립하는지 판정한다.
 *
 * @param {Array} frames        원본 landmark 프레임 배열
 * @param {Array} aggregated    aggregateJointSamples() 결과
 * @returns {{ok:boolean, flags:string[], detail:object}}
 */
export function assessPoseMeasurement(frames, aggregated) {
  const flags = [];
  const frameList = Array.isArray(frames) ? frames : [];

  const inspections = frameList.map(inspectFrameLandmarks);
  const usableFrames = inspections.filter((i) => i.usable).length;

  if (usableFrames < MIN_FRAMES) flags.push(QUALITY_FLAG.FRAMES_INSUFFICIENT);
  if (frameList.length > 0 && usableFrames === 0) flags.push(QUALITY_FLAG.LANDMARKS_MISSING);
  if (usableFrames >= 2 && !hasCoordinateChange(frameList)) flags.push(QUALITY_FLAG.NO_COORDINATE_CHANGE);

  // 관절 단위 판정 — DIP가 하나도 풀리지 않으면 끝마디 관찰 자체가 불가능하다.
  let dipResolved = 0;
  let pipResolved = 0;
  let unstable = false;
  let nonFinite = false;

  (aggregated ?? []).forEach((f) => {
    if (f.dip?.valid) dipResolved += 1;
    if (f.pip?.valid) pipResolved += 1;
    [f.dip, f.pip].forEach((j) => {
      if (!j) return;
      if (j.valid && (!Number.isFinite(j.flexionDeg) || !Number.isFinite(j.deviationDeg))) nonFinite = true;
      if (j.valid && j.flexionSpreadDeg > MAX_STABLE_SPREAD_DEG) unstable = true;
    });
  });

  if (nonFinite) flags.push(QUALITY_FLAG.NON_FINITE);
  if (unstable) flags.push(QUALITY_FLAG.UNSTABLE_POSE);
  if (aggregated?.length && dipResolved === 0) flags.push(QUALITY_FLAG.TIP_OCCLUDED);
  if (aggregated?.length && dipResolved === 0 && pipResolved === 0) flags.push(QUALITY_FLAG.JOINT_UNRESOLVED);

  // 성공 조건: 프레임이 충분하고, 좌표가 실제로 움직였고, 값이 유한하며,
  // 최소한 한 손가락의 관절이 풀렸을 것. 각도의 크기는 판정에 쓰지 않는다.
  const ok =
    !flags.includes(QUALITY_FLAG.FRAMES_INSUFFICIENT) &&
    !flags.includes(QUALITY_FLAG.LANDMARKS_MISSING) &&
    !flags.includes(QUALITY_FLAG.NO_COORDINATE_CHANGE) &&
    !flags.includes(QUALITY_FLAG.NON_FINITE) &&
    !flags.includes(QUALITY_FLAG.JOINT_UNRESOLVED);

  return {
    ok,
    flags,
    detail: {
      totalFrames: frameList.length,
      usableFrames,
      dipResolved,
      pipResolved,
    },
  };
}

/**
 * 여러 포즈의 판정을 합쳐 측정 전체가 성립하는지 본다.
 * 어느 포즈든 각도가 작다는 이유로 실패시키지 않는다.
 */
export function assessMeasurement(poseAssessments) {
  const entries = Object.entries(poseAssessments ?? {});
  if (!entries.length) return { ok: false, flags: [QUALITY_FLAG.FRAMES_INSUFFICIENT], byPose: {} };

  const flags = [...new Set(entries.flatMap(([, a]) => a.flags))];
  return {
    ok: entries.every(([, a]) => a.ok),
    flags,
    byPose: Object.fromEntries(entries.map(([pose, a]) => [pose, { ok: a.ok, flags: a.flags, detail: a.detail }])),
  };
}

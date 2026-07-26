// ─────────────────────────────────────────────
// CaptureObservationAdapter — capture 문서를 비교 화면이 읽을 형태로 정규화한다 (RC1.2.2 P0-10)
//
// 배경: 신규 capture는 perFingerJointObservation / dipContourObservation / deviationDirection을
// 저장하는데, 비교 화면은 구형 필드(averageObservedRomDeg / perFingerObservedRomDeg)만 읽고
// 있었다. 일부 실기기에서 구형 ROM이 0으로 기록돼, 신규 값이 멀쩡히 있는데도 비교 화면이
// 전부 0°로 보였다.
//
// 규칙:
//   - 신규 필드가 있으면 그것이 source of truth다. 구형 필드는 legacy fallback으로만 쓴다.
//   - 누락값을 0으로 대체하지 않는다. 없으면 null이고, 화면에서 "—"로 표시된다.
//   - 구형 기록을 신형 수치로 변환·추정하지 않는다(원본이 없어 복원 불가).
// ─────────────────────────────────────────────

export const OBSERVATION_GENERATION = {
  /** 관절별(DIP/PIP) 관찰이 기록된 세대 */
  JOINT_V1_1: "joint_v1_1",
  /** 손가락 평균/전체 ROM만 있는 이전 세대 */
  LEGACY_ROM: "legacy_rom",
};

/** 신규 관절별 관찰이 실제로 담겨 있는지 — 배열이 있고 비어있지 않아야 한다. */
export function hasJointObservation(capture) {
  return Array.isArray(capture?.perFingerJointObservation)
    && capture.perFingerJointObservation.length > 0;
}

/** 숫자만 통과시킨다. undefined·null·NaN은 전부 null(=미관찰)로 만든다. 0은 유효한 값이다. */
function num(v) {
  return Number.isFinite(v) ? v : null;
}

function contourOf(capture, key) {
  const fingers = capture?.dipContourObservation?.fingers;
  if (!Array.isArray(fingers)) return null;
  const f = fingers.find((x) => x.key === key);
  if (!f) return null;
  return {
    dipWidthRatio: num(f.dipWidthRatio),
    contourAsymmetryRatio: num(f.contourAsymmetryRatio),
    radialHalfWidthRatio: num(f.radialHalfWidthRatio),
    ulnarHalfWidthRatio: num(f.ulnarHalfWidthRatio),
  };
}

/**
 * capture 문서를 비교 화면용 관찰 구조로 정규화한다.
 * @returns {{generation:string, handSide:*, capturedAt:*, fingers:Array, symptomSnapshot:*}|null}
 */
export function toObservationView(capture) {
  if (!capture) return null;

  const joint = hasJointObservation(capture);
  const generation = joint ? OBSERVATION_GENERATION.JOINT_V1_1 : OBSERVATION_GENERATION.LEGACY_ROM;

  const base = {
    generation,
    handSide: capture.handSide ?? null,
    capturedAt: capture.capturedAt ?? null,
    algorithmVersion: capture.algorithmVersion ?? null,
    symptomSnapshot: capture.symptomSnapshot ?? null,
  };

  if (joint) {
    return {
      ...base,
      fingers: capture.perFingerJointObservation.map((f) => ({
        key: f.key,
        name: f.name ?? f.key,
        dipExtensionPoseFlexionDeg: num(f.dipExtensionPoseFlexionDeg),
        dipExtensionPoseDeviationDeg: num(f.dipExtensionPoseDeviationDeg),
        dipDeviationDirection: f.dipDeviationDirection ?? null,
        dipActiveRomDeg: num(f.dipActiveRomDeg),
        pipExtensionPoseFlexionDeg: num(f.pipExtensionPoseFlexionDeg),
        pipExtensionPoseDeviationDeg: num(f.pipExtensionPoseDeviationDeg),
        pipDeviationDirection: f.pipDeviationDirection ?? null,
        pipActiveRomDeg: num(f.pipActiveRomDeg),
        contour: contourOf(capture, f.key),
      })),
      // 이전 세대 리더 호환용으로 함께 저장되는 값. 신규 세대에서는 보조 표시로만 쓴다.
      legacyAverageRomDeg: num(capture.averageObservedRomDeg),
    };
  }

  // ── legacy 세대 ── 관절별 항목은 만들지 않는다(0으로 위장하지 않는다).
  const legacyFingers = Array.isArray(capture.perFingerObservedRomDeg)
    ? capture.perFingerObservedRomDeg
    : [];
  return {
    ...base,
    fingers: legacyFingers.map((f) => ({
      key: f.key,
      name: f.name ?? f.key,
      dipExtensionPoseFlexionDeg: null,
      dipExtensionPoseDeviationDeg: null,
      dipDeviationDirection: null,
      dipActiveRomDeg: null,
      pipExtensionPoseFlexionDeg: null,
      pipExtensionPoseDeviationDeg: null,
      pipDeviationDirection: null,
      pipActiveRomDeg: null,
      contour: null,
      legacyRomDeg: num(f.romDeg),
    })),
    legacyAverageRomDeg: num(capture.averageObservedRomDeg),
  };
}

/**
 * 두 capture의 세대가 달라 관절별 수치를 직접 비교할 수 없는지 판정한다.
 * 구형 기준선을 신형 수치로 추정해 메우지 않기 위한 게이트다.
 */
export function hasGenerationMismatch(baselineView, currentView) {
  if (!baselineView || !currentView) return false;
  return baselineView.generation !== currentView.generation;
}

/**
 * 기준선/현재를 손가락 key로 짝지어 비교 행을 만든다.
 * 한쪽에만 있는 손가락도 빠뜨리지 않고, 없는 쪽은 null로 남긴다.
 */
export function pairFingerObservations(baselineView, currentView) {
  const b = baselineView?.fingers ?? [];
  const c = currentView?.fingers ?? [];
  const keys = [...new Set([...b.map((f) => f.key), ...c.map((f) => f.key)])];
  return keys.map((key) => ({
    key,
    name: b.find((f) => f.key === key)?.name ?? c.find((f) => f.key === key)?.name ?? key,
    baseline: b.find((f) => f.key === key) ?? null,
    current: c.find((f) => f.key === key) ?? null,
  }));
}

/** 양쪽 모두 외곽 관찰이 있는지 — 한쪽만 있으면 직접 비교하지 않는다(§5). */
export function hasContourOnBothSides(baselineView, currentView) {
  const anyContour = (view) => (view?.fingers ?? []).some((f) => f.contour);
  return anyContour(baselineView) && anyContour(currentView);
}

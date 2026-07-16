// ─────────────────────────────────────────────
// fingerHealthScore
// 역할: Finger Health Score(Mobility/Stability/Inflammation/Recovery) 계산 정책.
// motionAnalyzer.js가 만든 metrics(각도/편위)를 입력받아 하위 점수 + 산출 근거(reason)를 만든다.
// Habit Score(습관/스트릭)는 별도 체계 — habitScore.js 참고.
// ─────────────────────────────────────────────

// v1.0: Recovery = 강직 성분(스캔 실측, 60%) + 피로도(자가 체크, 40%) 가중평균.
// v2.0: Recovery = 피로도(자가 체크) 단독. 확정된 Finger Health Score 하위지표 5개는
//       Mobility/Stability/Inflammation/Recovery/Habit이고 Stiffness는 그 안에 없어
//       계산식에서 제거했다(P0 작업4). v1.0 시점에 저장된 문서의 stiffnessComponent
//       필드는 읽기 전용 legacy로만 남고, 이 버전부터는 신규 계산에 쓰지 않는다.
export const SCORE_VERSION = "v2.0";

const WEIGHTS = { mobility: 0.35, stability: 0.15, inflammation: 0.25, recovery: 0.25 };

// 하위 점수가 없으면 50점 중립값을 넣지 않고 null로 유지한다 — "아직 모름"과 "낮은 점수"를
// 서로 다른 것으로 구분하기 위함(P0 안전 요건). UI는 null을 "측정 전"으로 표시한다.
export const DEFAULT_FINGER_HEALTH_SCORE = null;

/**
 * Mobility(관절가동범위) — spread(펼침)~fist(주먹) 사이 굴곡각 변화 폭을 정규화한다.
 * 90°를 기준 만점으로 잡는다 (건강한 PIP 관절의 대략적 최대 가동각).
 */
export function computeMobilityScore(perFinger) {
  if (!perFinger || !perFinger.length) return { value: null, reason: "스캔 데이터 없음" };
  const avgRom = perFinger.reduce((s, f) => s + f.rom, 0) / perFinger.length;
  const value = Math.round(Math.min(100, Math.max(0, (avgRom / 90) * 100)));
  return { value, reason: `평균 가동범위 ${Math.round(avgRom)}° (기준 90°)` };
}

/**
 * Stability(균형성) — 여러 자세에서의 좌우 측면편위(deviation) 평균.
 * 편위가 클수록 관절이 한쪽으로 틀어져 움직인다는 뜻이라 점수를 낮춘다.
 */
export function computeStabilityScore(...poseArrays) {
  const all = poseArrays.flat().filter(Boolean);
  if (!all.length) return { value: null, reason: "스캔 데이터 없음" };
  const avgDeviation = all.reduce((s, f) => s + f.deviation, 0) / all.length;
  const value = Math.round(Math.min(100, Math.max(0, 100 - (avgDeviation / 15) * 100)));
  return { value, reason: `평균 측면편위 ${avgDeviation.toFixed(1)}° (기준 15° 이내)` };
}

/**
 * Inflammation(붓기) — 체크인 자가 신고값(0=없음~10=심함)을 점수로 환산.
 * 체크인이 없으면 null(측정 전)을 반환한다.
 */
export function computeInflammationScore(swellingLevel) {
  if (swellingLevel == null) return { value: null, reason: "체크인 없음" };
  const lvl = Math.min(10, Math.max(0, swellingLevel));
  const value = Math.round(100 - lvl * 10);
  return { value, reason: `자가 체크 붓기 ${lvl}/10` };
}

/**
 * @deprecated v2.0부터 Recovery 계산에 쓰이지 않는다(P0 작업4 — Stiffness는 확정 5대
 * 하위지표에 없음). v1.0 시기에 저장된 문서를 다루는 legacy 코드에서만 참조하고,
 * 신규 계산 경로에서는 호출하지 않는다.
 */
export function computeStiffnessComponent(spread) {
  if (!spread || !spread.length) return null;
  const avgResidualFlexion = spread.reduce((s, f) => s + f.flexion, 0) / spread.length;
  return Math.round(Math.min(100, Math.max(0, 100 - (avgResidualFlexion / 30) * 100)));
}

/** 피로도 자가 체크(0=없음~10=심함) 성분 — 체크인이 없으면 null. */
export function computeFatigueComponent(fatigueLevel) {
  if (fatigueLevel == null) return null;
  const lvl = Math.min(10, Math.max(0, fatigueLevel));
  return Math.round(100 - lvl * 10);
}

/**
 * Recovery(회복도) — v2.0부터 자가보고 피로도(체크인) 단독 기준이다(SCORE_VERSION 주석 참고).
 * 체크인이 없으면 null(측정 전).
 */
export function computeRecoveryScore(fatigueComponent) {
  if (fatigueComponent == null) {
    return { value: null, reason: "체크인 데이터 없음" };
  }
  return { value: fatigueComponent, reason: `자가 체크 피로도 ${fatigueComponent}점 반영` };
}

/**
 * 4개 하위 점수를 가중합해 최종 Finger Health Score를 만든다.
 * 하나라도 아직 측정되지 않았으면(value: null) 억지로 가중합하지 않고 total도 null로
 * 둔다 — "일부만 반영된 점수"보다 "아직 측정 전"이 사용자에게 더 정확한 정보다.
 */
export function computeFingerHealthScore({ mobility, stability, inflammation, recovery }) {
  const w = WEIGHTS;
  const subScores = { mobility, stability, inflammation, recovery };
  const hasAllSubScores = Object.values(subScores).every((s) => s.value != null);
  const total = hasAllSubScores
    ? Math.round(
        mobility.value * w.mobility + stability.value * w.stability +
        inflammation.value * w.inflammation + recovery.value * w.recovery
      )
    : null;
  return { total, scoreVersion: SCORE_VERSION, mobility, stability, inflammation, recovery };
}

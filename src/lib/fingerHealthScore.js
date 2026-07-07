// ─────────────────────────────────────────────
// fingerHealthScore
// 역할: Finger Health Score(Mobility/Stability/Inflammation/Recovery) 계산 정책.
// motionAnalyzer.js가 만든 metrics(각도/편위)를 입력받아 하위 점수 + 산출 근거(reason)를 만든다.
// Habit Score(습관/스트릭)는 별도 체계 — habitScore.js 참고.
// ─────────────────────────────────────────────

export const SCORE_VERSION = "v1.0";

const WEIGHTS = { mobility: 0.35, stability: 0.15, inflammation: 0.25, recovery: 0.25 };
// Recovery 내부 가중치 — 강직(스캔 실측)이 피로도(자가 체크)보다 객관적이라 비중을 더 둔다.
const RECOVERY_WEIGHTS = { stiffness: 0.6, fatigue: 0.4 };

// 하위 점수가 하나도 없는 신규 사용자의 기본 Finger Health Score = 중립값(50)의 가중합 = 50.
const NEUTRAL = { value: 50, reason: "데이터 없음 (중립값)" };
export const DEFAULT_FINGER_HEALTH_SCORE = 50;

/**
 * Mobility(관절가동범위) — spread(펼침)~fist(주먹) 사이 굴곡각 변화 폭을 정규화한다.
 * 90°를 기준 만점으로 잡는다 (건강한 PIP 관절의 대략적 최대 가동각).
 */
export function computeMobilityScore(perFinger) {
  if (!perFinger || !perFinger.length) return { value: 0, reason: "스캔 데이터 없음" };
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
  if (!all.length) return { value: 0, reason: "스캔 데이터 없음" };
  const avgDeviation = all.reduce((s, f) => s + f.deviation, 0) / all.length;
  const value = Math.round(Math.min(100, Math.max(0, 100 - (avgDeviation / 15) * 100)));
  return { value, reason: `평균 측면편위 ${avgDeviation.toFixed(1)}° (기준 15° 이내)` };
}

/**
 * Inflammation(붓기) — 체크인 자가 신고값(0=없음~10=심함)을 점수로 환산.
 * 체크인이 없으면 중립값(50)을 반환한다.
 */
export function computeInflammationScore(swellingLevel) {
  if (swellingLevel == null) return { ...NEUTRAL, reason: "체크인 없음 (중립값 적용)" };
  const lvl = Math.min(10, Math.max(0, swellingLevel));
  const value = Math.round(100 - lvl * 10);
  return { value, reason: `자가 체크 붓기 ${lvl}/10` };
}

/**
 * 강직(Stiffness) 성분 — spread(최대 신전 시도) 자세에서 남은 굴곡각으로 추정한다.
 * Recovery 하위 점수의 절반을 이룬다. 스캔 시점에만 계산 가능해 별도 함수로 분리.
 */
export function computeStiffnessComponent(spread) {
  if (!spread || !spread.length) return null;
  const avgResidualFlexion = spread.reduce((s, f) => s + f.flexion, 0) / spread.length;
  return Math.round(Math.min(100, Math.max(0, 100 - (avgResidualFlexion / 30) * 100)));
}

/** 피로도 자가 체크(0=없음~10=심함) 성분 — 체크인이 없으면 null(블렌딩 시 강직만 반영). */
export function computeFatigueComponent(fatigueLevel) {
  if (fatigueLevel == null) return null;
  const lvl = Math.min(10, Math.max(0, fatigueLevel));
  return Math.round(100 - lvl * 10);
}

/**
 * Recovery(회복도) = 강직 성분(60%) + 피로도 성분(40%) 가중평균.
 * 둘 중 하나만 있으면 있는 것만 반영, 둘 다 없으면 중립값(50).
 * 반환값의 stiffnessComponent는 다음 컨디션 체크인 때 재결합할 수 있도록 그대로 보존한다.
 */
export function computeRecoveryScore(stiffnessComponent, fatigueComponent) {
  const w = RECOVERY_WEIGHTS;
  if (stiffnessComponent == null && fatigueComponent == null) {
    return { value: 50, reason: "스캔·체크인 데이터 없음 (중립값 적용)", stiffnessComponent: null };
  }
  if (fatigueComponent == null) {
    return { value: stiffnessComponent, reason: `강직 회복도 ${stiffnessComponent}점만 반영 (피로도 체크인 없음)`, stiffnessComponent };
  }
  if (stiffnessComponent == null) {
    return { value: fatigueComponent, reason: `피로도 ${fatigueComponent}점만 반영 (스캔 데이터 없음)`, stiffnessComponent: null };
  }
  const value = Math.round(stiffnessComponent * w.stiffness + fatigueComponent * w.fatigue);
  return {
    value,
    reason: `강직 회복도 ${stiffnessComponent}점(${w.stiffness * 100}%) + 피로도 ${fatigueComponent}점(${w.fatigue * 100}%) 가중평균`,
    stiffnessComponent,
  };
}

/** 4개 하위 점수를 가중합해 최종 Finger Health Score를 만든다. */
export function computeFingerHealthScore({ mobility, stability, inflammation, recovery }) {
  const w = WEIGHTS;
  const total = Math.round(
    mobility.value * w.mobility + stability.value * w.stability +
    inflammation.value * w.inflammation + recovery.value * w.recovery
  );
  return { total, scoreVersion: SCORE_VERSION, mobility, stability, inflammation, recovery };
}

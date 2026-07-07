// src/lib/getTodayAction.js
// Recommendation Engine — Rule-Based 최소 버전. "오늘 뭘 해야 하는지"만 명확히 안내한다.
// AI 예측이나 복잡한 로직 없이, 논의된 3가지 규칙만 우선순위 순서로 판정한다.
//   1. 붓기가 낮음        → 온수 스트레칭 추천 (지금 무리 없이 스트레칭하기 좋은 상태)
//   2. Consistency가 낮음 → 기록(스캔/체크인) 유도
//   3. Mobility 상승 추세  → 지금 루틴 유지 격려
// 셋 다 해당 없으면 중립 기본 문구.

const SWELLING_LOW_THRESHOLD = 3; // 0(없음)~10(심함) 자가체크 기준, 3 이하면 "낮음"
const CONSISTENCY_LOW_THRESHOLD = 50; // 최근 7일 중 활동 비율(%) 기준, 50% 미만이면 "저조"

/**
 * @param {{ name?: string, swellingLevel?: number|null, consistencyScore?: number|null, mobilityTrendUp?: boolean }} input
 */
export function getTodayAction({ name, swellingLevel, consistencyScore, mobilityTrendUp } = {}) {
  const displayName = name || "회원";

  if (swellingLevel != null && swellingLevel <= SWELLING_LOW_THRESHOLD) {
    return `${displayName} 님, 오늘은 붓기가 적어 스트레칭하기 좋은 상태예요. 3분 온수 스트레칭을 해보세요.`;
  }

  if (consistencyScore != null && consistencyScore < CONSISTENCY_LOW_THRESHOLD) {
    return `${displayName} 님, 최근 기록이 뜸해졌어요. 오늘 스캔이나 체크인을 한 번 남겨보면 변화를 더 정확히 볼 수 있어요.`;
  }

  if (mobilityTrendUp) {
    return `${displayName} 님, 최근 관절가동범위(Mobility)가 상승 추세예요! 지금 루틴을 그대로 이어가 보세요.`;
  }

  return `${displayName} 님, 오늘 컨디션을 체크인하고 스캔을 진행해 회복 데이터를 누적해 보세요.`;
}

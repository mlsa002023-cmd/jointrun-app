// ─────────────────────────────────────────────
// featureFlags
// V9 정렬(작업지시서 JR-WEB-202/JR-BIZ-209) — 기존 점수 UI와 가격 UI를 삭제하지 않고
// 플래그 뒤로 숨긴다. 값을 true로 되돌리면 즉시 기존 동작으로 복귀할 수 있어야 한다(가역성).
// 환경변수로 재정의 가능 — 운영 중 재빌드 없이 켜고 끄고 싶다면 VITE_FLAG_* 를 배포 환경에 추가한다.
// ─────────────────────────────────────────────

function readBooleanEnv(key, defaultValue) {
  const raw = import.meta.env?.[key];
  if (raw == null || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

// Finger Score/Inflammation/오늘의 행동 자동추천 등 절대 점수 UI 노출 여부.
// 기본 false — V9은 점수 대신 기준선 대비 관찰된 변화만 보여준다(08_QA_ACCEPTANCE_GATE.md Gate B).
export const FEATURE_FLAGS = {
  legacyScoreExperiment: readBooleanEnv("VITE_FLAG_LEGACY_SCORE", false),
  // 4주 패키지/Premium 결제 흐름. 초기에는 가격 노출·예약만 하고 실제 결제는 붙이지 않는다.
  pricingExperiment: readBooleanEnv("VITE_FLAG_PRICING", false),
};

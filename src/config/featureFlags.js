// ─────────────────────────────────────────────
// featureFlags
// V9 정렬(JR-WEB-202/JR-BIZ-209) — 기존 점수 UI와 가격 UI를 삭제하지 않고 플래그 뒤로 숨긴다.
// 값을 true로 되돌리면 즉시 기존 동작으로 복귀할 수 있어야 한다(가역성).
//
// 보안 — 왜 URL 파라미터나 localStorage로 조작할 수 없는가:
// 아래 값은 전부 import.meta.env.VITE_* 만 읽는다. Vite는 이 값들을 "런타임에 읽는 값"이
// 아니라 빌드 시점에 소스 코드 안에 상수로 직접 박아넣는다(정적 치환). 그래서:
//   - production 빌드(`npm run build`)에는 배포 환경(Vercel 등)에 VITE_FLAG_*를 설정해두지
//     않는 한 전부 기본값(false)으로 고정되어 결과물(JS 번들)에 아예 값이 박힌다.
//   - 브라우저 devtools에서 URL 쿼리스트링을 바꾸거나 localStorage.setItem(...)을 호출해도
//     이 값을 바꿀 수 없다 — 애초에 이 파일이 URL이나 localStorage를 읽지 않기 때문이다.
// 즉 "일반 사용자의 조작으로 노출되지 않아야 한다"는 요건은 여기서 실수로 location.search나
// localStorage를 참조하는 코드를 추가하지 않는 한 자동으로 충족된다(featureFlags.test.js가
// 이 소스 파일 안에 그런 참조가 없는지 회귀 테스트로 고정한다).
// ─────────────────────────────────────────────

function readBooleanEnv(key, defaultValue) {
  const raw = import.meta.env?.[key];
  if (raw == null || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

export const FEATURE_FLAGS = {
  // Finger Score/Inflammation/오늘의 행동 자동추천 등 절대 점수 UI 노출 여부.
  // 기본 false — V9은 점수 대신 기준선 대비 관찰된 변화만 보여준다(08_QA_ACCEPTANCE_GATE.md Gate B).
  absoluteScoreUiEnabled: readBooleanEnv("VITE_FLAG_ABSOLUTE_SCORE_UI", false),
  // 4주 패키지/Premium 결제 흐름. 초기에는 가격 노출·예약만 하고 실제 결제는 붙이지 않는다.
  pricingExperiment: readBooleanEnv("VITE_FLAG_PRICING", false),
};

// ─────────────────────────────────────────────
// Mock Capture — 카메라/실기기 없이 트리거→기준선→재확인→비교 전체 흐름을 개발·QA 환경에서
// E2E로 검증하기 위한 개발 전용 우회 경로. 이중 차단:
//   1) import.meta.env.DEV — Vite가 production 빌드에서는 이 값을 항상 false로 정적 치환한다.
//      번들에 이 분기 자체가 아예 죽은 코드로 남거나(트리셰이킹) 최소한 절대 true가 될 수 없다.
//   2) VITE_ENABLE_MOCK_CAPTURE — 로컬 개발 서버(`npm run dev`)를 그냥 켰다고 자동으로
//      뜨지 않도록, 명시적으로 .env.local에 설정해야만 켜지는 2차 게이트.
// 두 조건 모두 만족해야 하므로 production에는 어떤 경로로도 노출되지 않는다.
// ─────────────────────────────────────────────
export const MOCK_CAPTURE_ENABLED = import.meta.env.DEV === true && readBooleanEnv("VITE_ENABLE_MOCK_CAPTURE", false);

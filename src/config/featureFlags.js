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
// QA 모드 — 대표 검수용 Vercel Preview 배포에서만 Mock Capture/시점 이동/오류 시뮬레이션/
// 기록 초기화 같은 QA 전용 도구를 노출하기 위한 플래그.
//
// VITE_QA_MODE_ENABLED는 Vercel 프로젝트의 "Preview" 환경 변수로만 설정한다("Production"
// 환경 변수에는 절대 설정하지 않는다 — Vercel은 Production/Preview/Development 환경별로
// 서로 다른 값을 지정할 수 있다). 이 값을 Production 환경 변수에 설정하지 않는 것이
// production에서 QA 도구가 노출되지 않게 하는 유일하고 절대적인 안전장치다.
// ─────────────────────────────────────────────
const RAW_QA_MODE_ENABLED = readBooleanEnv("VITE_QA_MODE_ENABLED", false);

// QA 계정 allowlist — "지정된 검수 계정에서만" 요건에 대한 2차 방어선.
// VITE_QA_ALLOWED_EMAILS를 콤마로 구분해 설정하면, QA_MODE 플래그가 켜져 있어도
// 목록에 없는 이메일로 로그인한 사용자에게는 QA 도구가 보이지 않는다.
// 비워두면(설정 안 하면) 플래그만으로 판단한다(허용 목록 없음).
const QA_ALLOWED_EMAILS = (import.meta.env?.VITE_QA_ALLOWED_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const FEATURE_FLAGS_QA = {
  qaModeEnabled: RAW_QA_MODE_ENABLED,
};

// 현재 로그인한 사용자에게 QA 도구를 보여줘도 되는지 판단한다.
// user는 AuthContext의 currentUser(파이어베이스 User 객체 또는 데모 사용자)를 그대로 전달한다.
export function isQaModeActiveForUser(user) {
  if (!RAW_QA_MODE_ENABLED) return false;
  if (QA_ALLOWED_EMAILS.length === 0) return true;
  const email = user?.email?.toLowerCase();
  return Boolean(email && QA_ALLOWED_EMAILS.includes(email));
}

// ─────────────────────────────────────────────
// Mock Capture — 카메라/실기기 없이 트리거→기준선→재확인→비교 전체 흐름을 개발·QA 환경에서
// E2E로 검증하기 위한 개발 전용 우회 경로. 두 가지 경로 중 하나로만 켜진다:
//   1) 로컬 개발: import.meta.env.DEV === true AND VITE_ENABLE_MOCK_CAPTURE=true(.env.local).
//      Vite가 production/preview 빌드에서는 DEV를 항상 false로 정적 치환하므로 이 경로는
//      `npm run dev`로 실행 중인 로컬 머신에서만 성립할 수 있다.
//   2) Preview 배포: VITE_QA_MODE_ENABLED=true(Vercel Preview 환경 변수). Production 환경
//      변수에는 이 값을 설정하지 않으므로 production 빌드에서는 이 경로도 항상 false다.
// 화면에 실제로 노출할지는 shouldShowQaTools()로 한 번 더 계정 allowlist를 확인한다.
// ─────────────────────────────────────────────
export const MOCK_CAPTURE_ENABLED =
  (import.meta.env.DEV === true && readBooleanEnv("VITE_ENABLE_MOCK_CAPTURE", false)) ||
  RAW_QA_MODE_ENABLED;

// 실제 화면에 QA 도구(Mock Capture 버튼, 시점 이동, 오류 시뮬레이션, 기록 초기화)를
// 렌더링해도 되는지의 최종 판단. 로컬 개발(DEV)에서는 계정 구분 없이 기존처럼 동작하고,
// 빌드된 배포본(Preview)에서는 로그인한 계정이 allowlist를 통과해야만 true가 된다.
export function shouldShowQaTools(user) {
  if (!MOCK_CAPTURE_ENABLED) return false;
  if (import.meta.env.DEV === true) return true;
  return isQaModeActiveForUser(user);
}

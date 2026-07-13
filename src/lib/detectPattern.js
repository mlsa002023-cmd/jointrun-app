// ─────────────────────────────────────────────
// detectPattern
// 역할: 최근 N일간의 scans 데이터로 "안정적 유지 / 변동성 증가 / 지속적 저하" 중 하나를 판정한다.
// getTodayAction.js의 기존 행동 추천(오늘의 행동)과는 별개로 병행 실행되는 "패턴 관찰" 기능이다
// (작업지시서 §7.1). 개인별 임계값 조정 등 향후 정교화를 위해 순수 함수로 분리해뒀다.
//
// 카피 가이드라인(§5.2)을 그대로 따른다 — 원인 진단·행동 지시 없이 관찰된 사실만 서술.
// "지속적 저하" 문구는 §5.2에 예시로 제시된 문장을 그대로 사용한다.
// ─────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SCANS = 4;
const WINDOW_DAYS = 14;

const PATTERNS = {
  insufficient: { status: "insufficient", message: "패턴을 판단하기엔 아직 기록이 부족합니다." },
  stable: { status: "stable", message: "최근 기록이 일정한 범위 안에서 유지되고 있습니다." },
  volatile: { status: "volatile", message: "최근 기록의 변동 폭이 평소보다 커졌습니다." },
  declining: { status: "declining", message: "최근 2주간 낮은 상태가 반복되고 있습니다." },
};

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function stdDev(nums) {
  const m = average(nums);
  return Math.sqrt(average(nums.map((n) => (n - m) ** 2)));
}

/**
 * scans: getScanHistory() 반환값(최신순) — { createdAt: Timestamp, scores: { total } }[]
 * 반환: { status: "insufficient" | "stable" | "volatile" | "declining", message: string }
 */
export function detectPattern(scans, now = new Date()) {
  const withDates = (scans ?? [])
    .map((s) => ({ date: s.createdAt?.toDate ? s.createdAt.toDate() : null, score: s.scores?.total }))
    .filter((s) => s.date && s.score != null && (now - s.date) / DAY_MS <= WINDOW_DAYS)
    .sort((a, b) => a.date - b.date); // 오래된 순

  if (withDates.length < MIN_SCANS) {
    return PATTERNS.insufficient;
  }

  const scores = withDates.map((s) => s.score);
  const mid = Math.floor(scores.length / 2);
  const earlierHalf = scores.slice(0, mid);
  const recentHalf = scores.slice(mid);
  const earlierAvg = average(earlierHalf);
  const recentAvg = average(recentHalf);

  // 최근 절반 평균이 이전 절반 평균보다 뚜렷하게(8%+) 낮으면 지속적 저하로 판정.
  if (recentAvg < earlierAvg * 0.92) {
    return PATTERNS.declining;
  }

  // 전체 구간의 표준편차가 평균 대비 크면(변동계수 12%+) 변동성 증가로 판정.
  const overallAvg = average(scores);
  const cv = overallAvg > 0 ? stdDev(scores) / overallAvg : 0;
  if (cv >= 0.12) {
    return PATTERNS.volatile;
  }

  return PATTERNS.stable;
}

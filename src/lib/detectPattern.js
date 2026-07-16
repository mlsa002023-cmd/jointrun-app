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

// Report "월간 요약"용 — 판정 로직(아래 함수 본문)은 그대로 재사용하고, "2주"가 문장에
// 박혀있던 PATTERNS 대신 이 문구 세트만 갈아끼운다(§7.3). 새 판정 알고리즘은 아니다.
const MONTHLY_PATTERNS = {
  insufficient: { status: "insufficient", message: "패턴을 판단하기엔 이번 달 기록이 아직 부족합니다." },
  stable: { status: "stable", message: "이번 달 기록이 일정한 범위 안에서 유지되고 있습니다." },
  volatile: { status: "volatile", message: "이번 달 기록의 변동 폭이 평소보다 컸습니다." },
  declining: { status: "declining", message: "이번 달 낮은 상태가 반복되었습니다." },
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
 * windowDays/patterns: 기본값은 기존 HOME/Report "패턴 관찰" 카드와 동일(14일 · PATTERNS).
 * 반환: { status: "insufficient" | "stable" | "volatile" | "declining", message: string }
 */
export function detectPattern(scans, now = new Date(), { windowDays = WINDOW_DAYS, patterns = PATTERNS } = {}) {
  const withDates = (scans ?? [])
    .map((s) => ({ date: s.createdAt?.toDate ? s.createdAt.toDate() : null, score: s.scores?.total }))
    .filter((s) => s.date && s.score != null && (now - s.date) / DAY_MS <= windowDays)
    .sort((a, b) => a.date - b.date); // 오래된 순

  if (withDates.length < MIN_SCANS) {
    return patterns.insufficient;
  }

  const scores = withDates.map((s) => s.score);
  const mid = Math.floor(scores.length / 2);
  const earlierHalf = scores.slice(0, mid);
  const recentHalf = scores.slice(mid);
  const earlierAvg = average(earlierHalf);
  const recentAvg = average(recentHalf);

  // 최근 절반 평균이 이전 절반 평균보다 뚜렷하게(8%+) 낮으면 지속적 저하로 판정.
  if (recentAvg < earlierAvg * 0.92) {
    return patterns.declining;
  }

  // 전체 구간의 표준편차가 평균 대비 크면(변동계수 12%+) 변동성 증가로 판정.
  const overallAvg = average(scores);
  const cv = overallAvg > 0 ? stdDev(scores) / overallAvg : 0;
  if (cv >= 0.12) {
    return patterns.volatile;
  }

  return patterns.stable;
}

// Report 전용 얇은 래퍼 — 이번 달(달력 기준 일수)을 windowDays로, MONTHLY_PATTERNS를 문구로 넘길 뿐
// detectPattern의 판정 로직은 그대로다.
export function detectMonthlyPattern(scans, now = new Date()) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return detectPattern(scans, now, { windowDays: daysInMonth, patterns: MONTHLY_PATTERNS });
}

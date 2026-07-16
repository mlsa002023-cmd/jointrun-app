// ─────────────────────────────────────────────
// monthlyTrend
// 역할: Report "월간 평균 추이 그래프"용 — 이번 달(달력 기준) 스캔을 주차별로 묶어 평균을 낸다.
// PatternDetector/relativeChange와 달리 문장이 아니라 그래프용 숫자만 반환하므로 카피
// 가이드라인 대상은 아니다. 새 판정 로직이 아니라 기존 scans 데이터의 단순 집계.
// ─────────────────────────────────────────────

/**
 * scans: getScanHistory() 반환값 — { createdAt: Timestamp, scores: { total } }[]
 * 반환: { weeks: { week: string, avg: number, count: number }[], hasData: boolean }
 *   hasData는 주차가 2개 이상일 때만 true — 추이라고 부를 최소 조건(TimelineModule의
 *   hasRealData 관례와 동일).
 */
export function computeMonthlyTrend(scans, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  const withDates = (scans ?? [])
    .map((s) => ({ date: s.createdAt?.toDate ? s.createdAt.toDate() : null, score: s.scores?.total }))
    .filter((s) => s.date && s.score != null && s.date.getFullYear() === year && s.date.getMonth() === month);

  const buckets = new Map(); // 주차(1-based) -> score[]
  withDates.forEach((s) => {
    const weekIndex = Math.ceil(s.date.getDate() / 7);
    if (!buckets.has(weekIndex)) buckets.set(weekIndex, []);
    buckets.get(weekIndex).push(s.score);
  });

  const weeks = [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((weekIndex) => {
      const scores = buckets.get(weekIndex);
      const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
      return { week: `${weekIndex}주차`, avg: Math.round(avg), count: scores.length };
    });

  return { weeks, hasData: weeks.length >= 2 };
}

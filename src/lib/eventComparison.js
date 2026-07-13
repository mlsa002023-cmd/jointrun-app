// 이벤트 전후 N주(기본 3주) Finger Score 비교 — Decision Log 드릴다운(작업지시서 §6.1)의 핵심 로직.
// "관찰된 사실"만 반환한다(원인 진단 없음) — 화면에서 어떻게 서술할지는 컴포넌트 몫.
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeEventComparison(event, scans, windowWeeks = 3) {
  const windowMs = windowWeeks * 7 * DAY_MS;
  const eventTime = event.date.getTime();

  const withDates = scans
    .map((s) => ({ date: s.createdAt?.toDate ? s.createdAt.toDate() : null, score: s.scores?.total }))
    .filter((s) => s.date && s.score != null);

  const before = withDates
    .filter((s) => s.date.getTime() < eventTime && eventTime - s.date.getTime() <= windowMs)
    .sort((a, b) => a.date - b.date);
  const after = withDates
    .filter((s) => s.date.getTime() >= eventTime && s.date.getTime() - eventTime <= windowMs)
    .sort((a, b) => a.date - b.date);

  const hasEnoughData = before.length >= 1 && after.length >= 1;
  const avg = (arr) => (arr.length ? arr.reduce((sum, s) => sum + s.score, 0) / arr.length : null);

  return {
    windowWeeks,
    before,
    after,
    beforeAvg: avg(before),
    afterAvg: avg(after),
    hasEnoughData,
  };
}

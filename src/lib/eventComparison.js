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

// Report "대표 변화 1건"용 — 이번 달 이벤트 각각에 위 computeEventComparison을 그대로 돌려서,
// 전후 평균 차이(delta)가 가장 큰 이벤트 하나를 고른다. 비교 계산 자체는 재사용하고, 여기서는
// "여러 이벤트 중 하나를 선택"하는 로직만 추가한다.
//
// timelineItems: mergeScansAndEvents()의 반환값(kind로 scan/event 구분됨).
// 반환: { event, comparison, delta } | null(비교 가능한 이번 달 이벤트가 없으면).
export function findMostNotableEvent(timelineItems, scans, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonthEvents = (timelineItems ?? []).filter(
    (item) => item.kind === "event" && item.date.getFullYear() === year && item.date.getMonth() === month
  );

  let best = null;
  for (const event of thisMonthEvents) {
    const comparison = computeEventComparison(event, scans);
    if (!comparison.hasEnoughData) continue;
    const delta = Math.abs(comparison.afterAvg - comparison.beforeAvg);
    if (!best || delta > best.delta) {
      best = { event, comparison, delta };
    }
  }
  return best;
}

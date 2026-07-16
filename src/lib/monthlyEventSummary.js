// ─────────────────────────────────────────────
// monthlyEventSummary
// 역할: Report "Event 요약"용 — mergeScansAndEvents()가 만든 통합 리스트(kind 필드로 이미
// scan/event가 구분됨)에서 이번 달 이벤트만 걸러 타입별로 묶는다. 병합 로직 자체는 건드리지
// 않고 그 결과를 필터링·그룹핑만 한다.
// ─────────────────────────────────────────────

/**
 * timelineItems: mergeScansAndEvents()의 반환값 — { kind, id, date, label, type?, memo? }[]
 * 반환: { type: string, count: number, items: object[] }[] — count 내림차순.
 */
export function summarizeMonthlyEvents(timelineItems, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonthEvents = (timelineItems ?? []).filter(
    (item) => item.kind === "event" && item.date.getFullYear() === year && item.date.getMonth() === month
  );

  const groups = new Map(); // type -> item[]
  thisMonthEvents.forEach((item) => {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  });

  return [...groups.entries()]
    .map(([type, items]) => ({ type, count: items.length, items }))
    .sort((a, b) => b.count - a.count);
}

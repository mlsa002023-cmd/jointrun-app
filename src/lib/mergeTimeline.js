// scans(측정 기록)와 events(행동 기록)를 시간순 단일 리스트로 병합한다.
// TIMELINE 탭 전체 목록과 HOME의 축약 미리보기가 이 로직을 공유한다.
export function mergeScansAndEvents(scans, events) {
  const scanItems = scans.map((s) => ({
    kind: "scan",
    id: s.id,
    date: s.createdAt?.toDate ? s.createdAt.toDate() : null,
    label: "손 측정",
    scoreTotal: s.scores?.total ?? null,
  }));
  const eventItems = events.map((e) => ({
    kind: "event",
    id: e.id,
    date: e.timestamp?.toDate ? e.timestamp.toDate() : (e.timestamp ? new Date(e.timestamp) : null),
    label: e.label,
    type: e.type,
    memo: e.memo ?? null,
  }));
  return [...scanItems, ...eventItems]
    .filter((item) => item.date)
    .sort((a, b) => b.date - a.date);
}

export function formatTimelineDate(date) {
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

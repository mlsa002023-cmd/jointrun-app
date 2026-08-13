// scans(측정 기록)와 events(행동 기록)를 시간순 단일 리스트로 병합한다.
// TIMELINE 탭 전체 목록과 HOME의 축약 미리보기가 이 로직을 공유한다.
//
// FIX-1 §4 — 날짜 변환은 공통 toValidDate로 통일한다(Firestore Timestamp / {seconds,nanoseconds} /
// ISO / epoch 모두 안전 처리). 날짜 미확인은 뒤로 정렬하고, 표시 계층은 "날짜 미확인"으로 적는다.
import { toValidDate, formatDateValue, compareByDateDesc } from "./dateValue";

export function mergeScansAndEvents(scans, events) {
  const scanItems = scans.map((s) => ({
    kind: "scan",
    id: s.id,
    date: toValidDate(s.createdAt),
    label: "손 측정",
    scoreTotal: s.scores?.total ?? null,
  }));
  const eventItems = events.map((e) => ({
    kind: "event",
    id: e.id,
    date: toValidDate(e.timestamp),
    label: e.label,
    type: e.type,
    memo: e.memo ?? null,
  }));
  // 동일 (kind,id) 중복은 한 번만 표시한다(FIX-1 §3 중복 제거).
  const seen = new Set();
  const merged = [...scanItems, ...eventItems].filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // 날짜 미확인 항목도 버리지 않고 유지하되, 정렬에서 마지막으로 보낸다.
  return merged.sort((a, b) => compareByDateDesc(a.date, b.date));
}

export function formatTimelineDate(date) {
  return formatDateValue(date, { month: "long", day: "numeric" });
}

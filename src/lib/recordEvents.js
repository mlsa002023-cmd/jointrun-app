// ─────────────────────────────────────────────
// recordEvents — 최소 pub/sub 채널.
// EventMarkerModal이 이벤트를 저장한 시점과, 그 이벤트를 화면에 보여줘야 하는
// useTimelineData() 인스턴스(TimelineModule/RecentTimelinePreview 등, 마운트 위치는
// 다르지만 각자 독립적인 로컬 state를 가짐)를 리마운트 없이 연결하기 위한 용도.
// Repository/Firestore와는 무관한 순수 클라이언트 상태 전파 채널이다.
// ─────────────────────────────────────────────
const listeners = new Set();

export function subscribeToEventSaved(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitEventSaved(event) {
  listeners.forEach((callback) => callback(event));
}

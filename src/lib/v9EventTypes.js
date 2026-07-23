// ─────────────────────────────────────────────
// v9EventTypes
// 05_DATA_ANALYTICS_SPEC.md 기준 V9 Event(판단 트리거→기준선→재확인→비교→선택→결과) 엔터티 상수.
//
// 이름 주의: 기존 저장소에는 이미 users/{uid}/events/{id} 컬렉션(Event Marker — 병원방문 등
// 사용자가 남기는 자유 메모형 마커, src/lib/eventTypes.js)이 있다. V9 스펙의 "Event"는 전혀 다른
// 개념(트리거+기준선+재확인 상태를 갖는 판단 루프 컨테이너)이라 같은 컬렉션에 섞어 쓰면 문서
// 스키마가 충돌한다. 그래서 V9 Event는 컬렉션 경로를 v9Events로 분리했다(기존 events는 그대로 둠).
// ─────────────────────────────────────────────

export const V9_SCHEMA_VERSION = "v1.0";
export const CAPTURE_PROTOCOL_VERSION = "v1.0";
export const ALGORITHM_VERSION = "v1.0";

export const EVENT_STATUS = {
  DRAFT: "draft",
  CAPTURE_STARTED: "capture_started",
  CAPTURED: "captured",
  BASELINE_CREATED: "baseline_created",
  RECHECK_DUE: "recheck_due",
  RECHECKED: "rechecked",
  COMPARED: "compared",
  DECISION_LOGGED: "decision_logged",
  OUTCOME_LOGGED: "outcome_logged",
  COMPLETED: "completed",
};

export const EXCEPTION_STATUS = {
  CAPTURE_FAILED: "capture_failed",
  RECHECK_SKIPPED: "recheck_skipped",
  COMPARISON_UNRELIABLE: "comparison_unreliable",
  ABANDONED: "abandoned",
  DELETED: "deleted",
};

export const RECHECK_DUE_TYPE = { WEEK2: "week2", WEEK4: "week4", CUSTOM: "custom" };

export const RECHECK_STATUS = {
  SCHEDULED: "scheduled",
  DUE: "due",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  EXPIRED: "expired",
};

export const CAPTURE_TYPE = { BASELINE: "baseline", RECHECK: "recheck" };
export const QUALITY_STATUS = { PASS: "pass", RETRY: "retry", UNRELIABLE: "unreliable" };

export const PERCEIVED_CHANGE = {
  LESS: "less_discomfort",
  SAME: "same",
  MORE: "more_discomfort",
  UNCLEAR: "unclear",
};

// 05_DATA_ANALYTICS_SPEC.md §3 — 이번 P0 범위(트리거→기준선→재확인→비교)에서 실제로 발생시키는 이벤트만.
// Decision Log/Outcome/결제 관련 이벤트는 해당 기능(P1)을 구현할 때 함께 추가한다.
export const V9_ANALYTICS_EVENTS = {
  TRIGGER_SELECTED: "trigger_selected",
  CAPTURE_STARTED: "capture_started",
  CAPTURE_QUALITY_FAILED: "capture_quality_failed",
  CAPTURE_COMPLETED: "capture_completed",
  SYMPTOM_SAVED: "symptom_saved",
  BASELINE_CREATED: "baseline_created",
  RECHECK_SCHEDULED: "recheck_scheduled",
  RECHECK_STARTED: "recheck_started",
  RECHECK_COMPLETED: "recheck_completed",
  RECHECK_SKIPPED: "recheck_skipped",
  COMPARISON_VIEWED: "comparison_viewed",
};

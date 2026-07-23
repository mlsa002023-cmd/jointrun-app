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

// S12 Decision Log — "무엇을 선택했나요?" (CLAUDE_CODE_JOINTRUN_V9_DESIGN_INTEGRATION_PROMPT.md §4)
export const DECISION_TYPE = {
  HOSPITAL: "hospital_consult",
  EXERCISE: "exercise_stretch",
  BRACE: "brace_support",
  REST: "rest_or_compress",
  MEDICATION: "medication_supplement",
  OBSERVE: "observe_only",
  CUSTOM: "custom",
};
export const DECISION_TYPE_LABEL = {
  [DECISION_TYPE.HOSPITAL]: "병원 상담",
  [DECISION_TYPE.EXERCISE]: "운동·스트레칭",
  [DECISION_TYPE.BRACE]: "보호대·보조기",
  [DECISION_TYPE.REST]: "찜질·휴식",
  [DECISION_TYPE.MEDICATION]: "약·영양제",
  [DECISION_TYPE.OBSERVE]: "경과 관찰",
  [DECISION_TYPE.CUSTOM]: "기타",
};

// S12 — "왜 이 선택을 했나요?" (04_APP_PRD_V9.md S10과 동일 항목 재사용)
export const DECISION_REASON = {
  DISCOMFORT: "discomfort",
  MEDICAL_ADVICE: "medical_advice",
  RECOMMENDATION: "recommendation",
  PRIOR_EXPERIENCE: "prior_experience",
  CONVENIENCE_COST: "convenience_cost",
  CUSTOM: "custom",
};
export const DECISION_REASON_LABEL = {
  [DECISION_REASON.DISCOMFORT]: "증상이 불편해서",
  [DECISION_REASON.MEDICAL_ADVICE]: "의료진 권유",
  [DECISION_REASON.RECOMMENDATION]: "주변 추천",
  [DECISION_REASON.PRIOR_EXPERIENCE]: "이전 경험",
  [DECISION_REASON.CONVENIENCE_COST]: "사용 편의성·비용",
  [DECISION_REASON.CUSTOM]: "기타",
};

// S13 Outcome — Comparison의 PERCEIVED_CHANGE와 별개 엔터티(지시서 §4 필드명 그대로).
export const PERCEIVED_OUTCOME = { LESS: "less", SAME: "same", MORE: "more", UNSURE: "unsure" };
export const PERCEIVED_OUTCOME_LABEL = {
  [PERCEIVED_OUTCOME.LESS]: "덜 불편함",
  [PERCEIVED_OUTCOME.SAME]: "비슷함",
  [PERCEIVED_OUTCOME.MORE]: "더 불편함",
  [PERCEIVED_OUTCOME.UNSURE]: "판단 어려움",
};

export const CONTINUED_ACTION = { CONTINUE: "continue", CHANGE: "change", STOP: "stop", CONSULT: "consult" };
export const CONTINUED_ACTION_LABEL = {
  [CONTINUED_ACTION.CONTINUE]: "계속하기",
  [CONTINUED_ACTION.CHANGE]: "다른 방법으로 변경",
  [CONTINUED_ACTION.STOP]: "중단하기",
  [CONTINUED_ACTION.CONSULT]: "전문가와 상담",
};

// 05_DATA_ANALYTICS_SPEC.md §3 + RC1 디자인 통합 지시서 §7 — 실제로 발생시키는 이벤트 전체.
export const V9_ANALYTICS_EVENTS = {
  ONBOARDING_STARTED: "onboarding_started",
  CONSENT_COMPLETED: "consent_completed",
  TRIGGER_SELECTED: "trigger_selected",
  CAPTURE_STARTED: "capture_started",
  CAPTURE_QUALITY_PASSED: "capture_quality_passed",
  CAPTURE_QUALITY_FAILED: "capture_quality_failed",
  CAPTURE_COMPLETED: "capture_completed",
  SYMPTOM_SNAPSHOT_SAVED: "symptom_snapshot_saved",
  BASELINE_CREATED: "baseline_created",
  RECHECK_DUE: "recheck_due",
  RECHECK_SCHEDULED: "recheck_scheduled",
  RECHECK_STARTED: "recheck_started",
  RECHECK_COMPLETED: "recheck_completed",
  RECHECK_SKIPPED: "recheck_skipped",
  COMPARISON_VIEWED: "comparison_viewed",
  DECISION_LOGGED: "decision_logged",
  OUTCOME_LOGGED: "outcome_logged",
  TIMELINE_VIEWED: "timeline_viewed",
  REPORT_VIEWED: "report_viewed",
  PRICING_VIEWED: "pricing_viewed",
  PILOT_CTA_CLICKED: "pilot_cta_clicked",
  DECISION_LOOP_COMPLETED: "decision_loop_completed",
};

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
// P0-14 — 3-포즈 관찰 프로토콜(정면·측면·굽힘)과 저장 구조가 바뀌어 버전을 올린다(v1.0 → v1.1).
export const CAPTURE_PROTOCOL_VERSION = "v1.1";
// RC1.2.2 P0-8 — PIP 평균 ROM에서 DIP/PIP 관절별 관찰로 확장(v1.0 → v1.1).
// P0-14 — 측면(fanLateral) 외곽 프로파일 관찰을 추가하며 v1.1 → v1.2. 이전 버전으로 기록된
// capture는 측면 관찰이 없으므로, 비교 화면에서 세대를 구분할 때 이 값을 본다.
export const ALGORITHM_VERSION = "v1.2";
// P0-14 — 포즈 프로토콜 식별자. 구형(포즈 프로토콜 값이 없는) 기록과 신규 기록을 구분해
// pose_protocol_mismatch를 판정하는 기준이다. 자동 마이그레이션·값 추정은 하지 않는다.
export const POSE_PROTOCOL_VERSION = "front-fan-fist-v1";

// P0-14 — 관찰 시점(정면/측면)을 구분하는 viewType. 같은 viewType끼리만 비교한다(§12).
export const VIEW_TYPE = {
  FRONT_SPREAD: "front_spread",
  OK_FAN_LATERAL: "ok_fan_lateral",
  MAX_COMFORTABLE_FIST: "max_comfortable_fist",
};

export const EVENT_STATUS = {
  DRAFT: "draft",
  CAPTURE_STARTED: "capture_started",
  CAPTURED: "captured",
  // RC1.2 — 각도 관찰 기록을 저장했지만 아직 증상을 함께 남기지 않은 상태.
  // 이 상태에서만 SymptomSnapshotForm으로 이어져 baseline_created로 확정된다.
  SYMPTOM_PENDING: "symptom_pending",
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

// RC1.2 — 각도 관찰 기록은 기준선 capture로 저장된다(기존 리더 type==="baseline" 호환).
// OBSERVATIONAL_ANGLE은 스펙상 별칭이며, 현재 저장 경로는 BASELINE을 사용한다.
export const CAPTURE_TYPE = { BASELINE: "baseline", RECHECK: "recheck", OBSERVATIONAL_ANGLE: "observational_angle" };
export const QUALITY_STATUS = { PASS: "pass", RETRY: "retry", UNRELIABLE: "unreliable" };

// ─────────────────────────────────────────────
// RC1.2.1 §3 — "기록을 마쳤다"와 "동일 조건 비교 품질이 검증됐다"는 서로 다른 사실이다.
//   recordingStatus         : 3개 동작 기록을 끝냈는가 (완료 여부)
//   comparisonQualityStatus : 조명·거리·흔들림 등 비교 조건을 실제로 검증했는가
// 각도 관찰 흐름은 아직 비교 조건을 검증하지 않으므로 unverified를 쓴다 — pass를 쓰지 않는다.
// ─────────────────────────────────────────────
export const RECORDING_STATUS = { COMPLETED: "completed", INCOMPLETE: "incomplete" };
export const COMPARISON_QUALITY_STATUS = {
  UNVERIFIED: "unverified", // 비교 조건 미검증(기본값)
  PASS: "pass",             // 실제 비교 조건 검증 통과
  UNRELIABLE: "unreliable", // 검증했으나 비교에 부적합
};

/**
 * 기존 capture(qualityStatus만 있는 문서)와 신규 capture(recordingStatus/
 * comparisonQualityStatus)를 같은 모양으로 읽기 위한 adapter. 마이그레이션 없이 동작한다.
 *  - 신규 필드가 있으면 그대로 사용
 *  - 없으면 legacy qualityStatus에서 유도: pass → 기록완료 + 비교품질 pass(과거 의미 보존),
 *    retry/unreliable → 기록완료 + unreliable
 */
export function readCaptureQuality(capture) {
  if (!capture) return { recordingStatus: null, comparisonQualityStatus: null };
  if (capture.recordingStatus || capture.comparisonQualityStatus) {
    return {
      recordingStatus: capture.recordingStatus ?? RECORDING_STATUS.COMPLETED,
      comparisonQualityStatus: capture.comparisonQualityStatus ?? COMPARISON_QUALITY_STATUS.UNVERIFIED,
    };
  }
  const legacy = capture.qualityStatus;
  if (!legacy) return { recordingStatus: null, comparisonQualityStatus: null };
  return {
    recordingStatus: RECORDING_STATUS.COMPLETED,
    comparisonQualityStatus: legacy === "pass"
      ? COMPARISON_QUALITY_STATUS.PASS
      : COMPARISON_QUALITY_STATUS.UNRELIABLE,
  };
}

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
  // RC1.2.2 P0-11/P0-12 — 오버레이·요약 사용 여부만 남긴다. 각도·외곽값 원문, raw 좌표,
  // 상세 수치, 직접 식별자는 절대 파라미터에 담지 않는다.
  DIP_OVERLAY_STARTED: "dip_contour_overlay_started",
  DIP_OVERLAY_COMPLETED: "dip_contour_overlay_completed",
  DIP_OVERLAY_RETRY_SHOWN: "dip_contour_overlay_retry_shown",
  // P0-14 §14 — 3-포즈 상태머신 이벤트. 파라미터는 poseId·coachCode·validFingerCount·
  // recordingStatus만 허용한다. 각도·외곽 비율·raw 좌표·증상·식별자는 절대 담지 않는다.
  POSE_ALIGNING_STARTED: "pose_aligning_started",
  POSE_HOLDING_STARTED: "pose_holding_started",
  POSE_CONFIRMED: "pose_confirmed",
  POSE_COACHING_SHOWN: "pose_coaching_shown",
  FAN_LATERAL_PARTIAL_RECORDED: "fan_lateral_partial_recorded",
  OBSERVATION_SUMMARY_VIEWED: "observation_summary_viewed",
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
  // RC1.2 — 각도 관찰 기록 → 증상 → 기준선 확정 흐름. property에 진단·점수값을 넣지 않는다.
  ANGLE_RECORD_STARTED: "angle_record_started",
  HAND_SIDE_SELECTED: "hand_side_selected",
  ANGLE_RECORD_SAVED: "angle_record_saved",
  SYMPTOM_PENDING_VIEWED: "symptom_pending_viewed",
  SYMPTOM_ENTRY_STARTED: "symptom_entry_started",
  BASELINE_COMPLETED: "baseline_completed",
  LEGACY_SCORE_PATH_BLOCKED: "legacy_score_path_blocked",
  DEBUG_ACCESS_DENIED: "debug_access_denied",
};

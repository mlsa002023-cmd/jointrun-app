// ─────────────────────────────────────────────
// triggerTypes
// 04_APP_PRD_V9.md S02 "판단 트리거 선택" 선택지의 단일 소스.
// primaryTrigger는 1개, secondaryTriggers는 복수 선택 가능(자기 자신 제외).
// ─────────────────────────────────────────────

export const TRIGGER_TYPES = [
  { value: "pain_stiffness", label: "통증·뻣뻣함이 늘어난 것 같아요" },
  { value: "shape_change", label: "손가락 모양이 달라 보이는 것 같아요" },
  { value: "function_difficulty", label: "움직임이나 손 사용이 불편해요" },
  { value: "swelling_warmth", label: "붓기·열감을 느껴요" },
  { value: "care_started", label: "병원·운동·보호대·제품을 새로 시작했어요" },
  { value: "custom", label: "기타" },
];

export function getTriggerLabel(value) {
  return TRIGGER_TYPES.find((t) => t.value === value)?.label ?? "";
}

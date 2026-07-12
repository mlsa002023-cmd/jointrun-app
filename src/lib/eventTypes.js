// ─────────────────────────────────────────────
// eventTypes
// 역할: 사용자가 직접 기록하는 "행동/선택" 이벤트(Event Marker)의 고정 타입 목록.
// Firestore 스키마(users/{uid}/events/{eventId})가 참조하는 단일 소스 — 여기 값을 하드코딩해서 흩뿌리지 말 것.
// 관절 부위가 손가락 외로 확장돼도 이 파일만 갱신하면 되도록 라벨/타입을 분리해둔다.
// ─────────────────────────────────────────────

export const EVENT_SCHEMA_VERSION = "v1.0";

/**
 * users/{uid}/events/{eventId}
 *   type: EVENT_TYPES 중 하나의 value ("custom" 포함)
 *   label: 화면 표시용 텍스트 (custom일 때만 사용자가 직접 입력, 그 외에는 EVENT_TYPES에서 파생)
 *   memo: string | null — 선택 입력
 *   timestamp: Timestamp — 이벤트가 실제로 일어난 시각 (사용자가 편집 가능, 기본값은 저장 시점)
 *   schemaVersion: EVENT_SCHEMA_VERSION
 *   createdAt: Timestamp — 서버가 기록을 실제로 저장한 시각 (serverTimestamp)
 */
export const EVENT_TYPES = [
  { value: "protector_start", label: "보호대 착용 시작" },
  { value: "protector_change", label: "보호대 교체" },
  { value: "hospital_visit", label: "병원 방문" },
  { value: "injection", label: "주사 치료" },
  { value: "exercise_start", label: "운동 시작" },
  { value: "medication_start", label: "약 복용 시작" },
  { value: "paraffin_start", label: "파라핀·찜질 시작" },
  { value: "custom", label: "직접 입력" },
];

export const CUSTOM_EVENT_TYPE = "custom";

export function getEventTypeLabel(type) {
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? "";
}

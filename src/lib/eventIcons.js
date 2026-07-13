import { Shield, RefreshCw, Building2, Syringe, Dumbbell, Pill, Waves, Sparkles, Camera } from "lucide-react";

// eventTypes.js의 EVENT_TYPES와 1:1로 대응하는 아이콘 — TIMELINE 항목 구성(작업지시서 §6.1)에 쓰인다.
export const EVENT_TYPE_ICONS = {
  protector_start: Shield,
  protector_change: RefreshCw,
  hospital_visit: Building2,
  injection: Syringe,
  exercise_start: Dumbbell,
  medication_start: Pill,
  paraffin_start: Waves,
  custom: Sparkles,
};

export const SCAN_ICON = Camera;

export function getTimelineIcon(item) {
  if (item.kind === "scan") return SCAN_ICON;
  return EVENT_TYPE_ICONS[item.type] ?? Sparkles;
}

import { detectPattern } from "../lib/detectPattern";

// "패턴 관찰" 카드 — HOME과 REPORT 양쪽에서 재사용(작업지시서 §7.1).
// getTodayAction의 "오늘의 행동" 추천과는 별개로, 최근 기록의 관찰 사실만 보여준다.
function PatternInsightCard({ scans }) {
  const { status, message } = detectPattern(scans);
  const toneClass =
    status === "declining"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : status === "volatile"
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : status === "insufficient"
      ? "bg-slate-50 border-slate-200 text-slate-500"
      : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={`border rounded-2xl p-3 shadow-sm ${toneClass}`}>
      <h4 className="text-xs font-bold mb-1">패턴 관찰</h4>
      <p className="text-[11px] leading-relaxed">{message}</p>
    </div>
  );
}

export default PatternInsightCard;

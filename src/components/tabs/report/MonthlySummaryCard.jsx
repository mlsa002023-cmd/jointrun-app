import JTCard from "../../ui/JTCard";

// "이번 달" 섹션 ① 월간 요약 문장 — PatternDetector.detectMonthly()의 관찰형 문구를 그대로 표시.
// HOME의 PatternInsightCard와 동일한 tone 매핑 패턴을 따른다.
function MonthlySummaryCard({ summary }) {
  const { status, message } = summary;
  const tone = status === "insufficient" ? "muted" : status === "stable" ? "info" : "warning";
  const textClass =
    status === "declining" ? "text-amber-800"
    : status === "volatile" ? "text-amber-700"
    : status === "insufficient" ? "text-slate-500"
    : "text-blue-800";

  return (
    <JTCard tone={tone} className={textClass}>
      <h4 className="text-xs font-bold mb-1">이번 달 요약</h4>
      <p className="text-[11px] leading-relaxed">{message}</p>
    </JTCard>
  );
}

export default MonthlySummaryCard;

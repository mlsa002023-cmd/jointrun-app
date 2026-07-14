import JTCard from "./JTCard";

// 제목 + 내용으로 된 카드(RecordSection/TimelineModule "전체 기록" 등에서 반복되던 패턴).
function JTSection({ title, trailing, tone = "default", children }) {
  return (
    <JTCard tone={tone}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-900">{title}</h4>
        {trailing}
      </div>
      {children}
    </JTCard>
  );
}

export default JTSection;

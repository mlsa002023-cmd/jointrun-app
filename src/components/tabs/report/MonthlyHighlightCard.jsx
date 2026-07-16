import JTCard from "../../ui/JTCard";

// "이번 달" 섹션 ④ 대표 변화 1건 — findMostNotableEvent()가 고른 이벤트의 전후 평균만
// 관찰형으로 서술한다(EventDetailModal과 동일하게 원인 진단·행동 권고 문구는 넣지 않는다).
function MonthlyHighlightCard({ highlight }) {
  if (!highlight) {
    return (
      <JTCard tone="muted">
        <h4 className="text-xs font-bold text-slate-800 mb-1">대표 변화</h4>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          이번 달은 비교할 만큼 뚜렷한 변화가 있는 기록이 없습니다.
        </p>
      </JTCard>
    );
  }

  const { event, comparison } = highlight;
  return (
    <JTCard tone="info">
      <h4 className="text-xs font-bold text-blue-900 mb-1">대표 변화 — {event.label}</h4>
      <p className="text-[11px] text-blue-800 leading-relaxed">
        이 기록 전 평균 <span className="font-bold">{comparison.beforeAvg.toFixed(0)}점</span>
        {" · "}
        이 기록 후 평균 <span className="font-bold">{comparison.afterAvg.toFixed(0)}점</span>으로 변화했습니다.
      </p>
    </JTCard>
  );
}

export default MonthlyHighlightCard;

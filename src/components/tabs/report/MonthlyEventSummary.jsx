import JTSection from "../../ui/JTSection";
import JTListItem from "../../ui/JTListItem";
import { getEventTypeLabel } from "../../../lib/eventTypes";
import { EVENT_TYPE_ICONS } from "../../../lib/eventIcons";

// "이번 달" 섹션 ③ Event 요약 — 이번 달 이벤트를 타입별로 묶어서 리스트로 보여준다.
//
// 현재 이 집계의 데이터 소스(useTimelineData → 레거시 getEvents)는 V9 Event·Capture·증상 메모를
// 포함하지 않는다. 따라서 eventGroups가 비어 있어도 그것이 "이번 달 기록 없음"을 신뢰성 있게
// 뜻하지 않는다(V9 기록만 있는 사용자가 있을 수 있다). 실제 기록이 있는데 '없음'으로 오표시하는
// 상태를 금지하기 위해, 비어 있으면 카드 자체를 숨긴다(빈 상태 문구를 노출하지 않는다).
function MonthlyEventSummary({ eventGroups }) {
  if (!eventGroups || eventGroups.length === 0) return null;
  return (
    <JTSection title="이번 달 기록">
      <div className="space-y-1">
        {eventGroups.map((group) => (
          <JTListItem
            key={group.type}
            icon={EVENT_TYPE_ICONS[group.type]}
            label={getEventTypeLabel(group.type)}
            trailing={<span className="text-[10px] font-bold text-blue-600">{group.count}회</span>}
          />
        ))}
      </div>
    </JTSection>
  );
}

export default MonthlyEventSummary;

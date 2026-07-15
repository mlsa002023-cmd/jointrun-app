import JTSection from "../../ui/JTSection";
import JTListItem from "../../ui/JTListItem";
import JTEmptyState from "../../ui/JTEmptyState";
import { getEventTypeLabel } from "../../../lib/eventTypes";
import { EVENT_TYPE_ICONS } from "../../../lib/eventIcons";

// "이번 달" 섹션 ③ Event 요약 — 이번 달 이벤트를 타입별로 묶어서 리스트로 보여준다.
function MonthlyEventSummary({ eventGroups }) {
  return (
    <JTSection title="이번 달 기록">
      {eventGroups.length === 0 ? (
        <JTEmptyState variant="compact" description="이번 달 기록된 이벤트가 없습니다." />
      ) : (
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
      )}
    </JTSection>
  );
}

export default MonthlyEventSummary;

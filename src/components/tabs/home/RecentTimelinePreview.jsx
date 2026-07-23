import { ChevronRight } from "lucide-react";
import JTCard from "../../ui/JTCard";
import JTSkeleton from "../../ui/JTSkeleton";
import JTEmptyState from "../../ui/JTEmptyState";
import { useTimelineData } from "../../../hooks/useTimelineData";
import { formatTimelineDate } from "../../../lib/mergeTimeline";
import { getTimelineIcon } from "../../../lib/eventIcons";
import { FEATURE_FLAGS } from "../../../config/featureFlags";

// HOME의 "최근 Timeline 요약" — TIMELINE 탭과 동일한 useTimelineData()를 재사용해 최신 3건만
// 잘라 보여준다. 예전에는 이 컴포넌트가 getScanHistory/getEventHistory를 직접 호출해
// TimelineModule/JOINTRUNShell과 같은 fetch 로직이 3곳에 중복돼 있었다 — 이제는 훅 하나뿐이다.
function RecentTimelinePreview({ setActiveTab }) {
  const { timelineItems, loading } = useTimelineData();
  const items = timelineItems.slice(0, 3);

  return (
    <JTCard>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-900">최근 Timeline</h4>
        <button onClick={() => setActiveTab("timeline")} className="text-[10px] font-bold text-blue-600 flex items-center">
          전체보기<ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {loading ? (
        <JTSkeleton height={32} count={2} />
      ) : items.length === 0 ? (
        <JTEmptyState variant="compact" description="아직 기록이 없습니다." />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = getTimelineIcon(item);
            return (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-[11px] text-slate-700">
                <span className="text-slate-400 shrink-0">{formatTimelineDate(item.date)}</span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${item.kind === "scan" ? "text-blue-500" : "text-orange-500"}`} />
                <span className="truncate">{item.label}{FEATURE_FLAGS.legacyScoreExperiment && item.kind === "scan" && item.scoreTotal != null ? ` (${item.scoreTotal}점)` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </JTCard>
  );
}

export default RecentTimelinePreview;

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getScanHistory, getEventHistory } from "../../../lib/firestore";
import { mergeScansAndEvents, formatTimelineDate } from "../../../lib/mergeTimeline";

// HOME의 "최근 Timeline 요약" — scans+events 병합 리스트의 최신 3건만 보여주고,
// 전체 목록/기간별 비교는 TIMELINE 탭(전체 병합 뷰)에서 다룬다.
function RecentTimelinePreview({ currentUser, setActiveTab }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser) { setItems([]); return; }
    (async () => {
      const [scans, events] = await Promise.all([
        getScanHistory(currentUser.uid, 5),
        getEventHistory(currentUser.uid, 5),
      ]);
      if (!cancelled) setItems(mergeScansAndEvents(scans, events).slice(0, 3));
    })();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-900">최근 Timeline</h4>
        <button onClick={() => setActiveTab("timeline")} className="text-[10px] font-bold text-blue-600 flex items-center">
          전체보기<ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {items === null ? (
        <div className="space-y-1.5">
          <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[10px] text-slate-400 py-2">아직 기록이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-[11px] text-slate-700">
              <span className="text-slate-400 shrink-0">{formatTimelineDate(item.date)}</span>
              <span className={item.kind === "scan" ? "text-blue-500" : "text-orange-500"}>●</span>
              <span className="truncate">{item.label}{item.kind === "scan" && item.scoreTotal != null ? ` (${item.scoreTotal}점)` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentTimelinePreview;

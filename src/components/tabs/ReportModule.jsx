import { BIOMARKER_METRICS } from "../../data/mockProfiles";
import PatternInsightCard from "../PatternInsightCard";
import JTCard from "../ui/JTCard";
import { useReportData } from "../../hooks/useReportData";
import { useMonthlyReportData } from "../../hooks/useMonthlyReportData";
import JTSkeleton from "../ui/JTSkeleton";
import MonthlySummaryCard from "./report/MonthlySummaryCard";
import MonthlyTrendChart from "./report/MonthlyTrendChart";
import MonthlyEventSummary from "./report/MonthlyEventSummary";
import MonthlyHighlightCard from "./report/MonthlyHighlightCard";

// REPORT 탭 — 조회 전용. 내보내기/공유(PDF 등)는 넣지 않는다. KPI 이벤트나 재방문 유도 장치도
// 이 화면엔 의도적으로 연결하지 않는다(설계상 낮은 재방문 압력 — docs/sprint-plan.md STEP 6).
// scans는 더 이상 JOINTRUNShell에서 prop으로 내려받지 않고 useReportData()가 직접 가져온다 —
// REPORT 탭은 mount될 때만 필요한 데이터라 HOME과 달리 리프에서 훅을 호출해도 무방하다.
function ReportModule({ currentProfile }) {
  const { scans } = useReportData();
  const monthly = useMonthlyReportData();
  const biomarkers = BIOMARKER_METRICS(currentProfile);
  const statusColors = { good:"bg-blue-50 border-blue-200 text-blue-700", stable:"bg-amber-50 border-amber-200 text-amber-700", warning:"bg-orange-50 border-orange-200 text-orange-700", danger:"bg-red-50 border-red-200 text-red-700" };
  const statusLabels = { good:"양호", stable:"주의", warning:"경고", danger:"위험" };

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Digital Biomarkers</p>
        <h2 className="text-sm font-bold text-slate-900">내 손의 디지털 바이오마커</h2>
      </div>
      <PatternInsightCard scans={scans} />
      <div className="space-y-2">
        {biomarkers.map(b => (
          <JTCard key={b.name} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-900">{b.tradeName}</p>
              <p className="text-[8px] text-slate-400 leading-relaxed line-clamp-2">{b.description}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-black text-slate-900 font-mono">{b.value}<span className="text-[9px] font-normal text-slate-400 ml-0.5">{b.unit}</span></div>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${statusColors[b.status]}`}>{statusLabels[b.status]}</span>
            </div>
          </JTCard>
        ))}
      </div>

      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">This Month</p>
        <h2 className="text-sm font-bold text-slate-900">이번 달</h2>
      </div>
      {monthly.loading ? (
        <JTSkeleton height={32} count={3} />
      ) : (
        <>
          <MonthlySummaryCard summary={monthly.summary} />
          <MonthlyTrendChart trend={monthly.trend} />
          <MonthlyEventSummary eventGroups={monthly.eventGroups} />
          <MonthlyHighlightCard highlight={monthly.highlight} />
        </>
      )}
    </div>
  );
}

export default ReportModule;

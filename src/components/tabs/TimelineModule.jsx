import { useState } from "react";
import { Printer, Plus } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as ChartTooltip, BarChart, Bar, Cell
} from "recharts";
import { formatTimelineDate } from "../../lib/mergeTimeline";
import { getTimelineIcon } from "../../lib/eventIcons";
import { useTimelineData } from "../../hooks/useTimelineData";
import EventDetailModal from "../EventDetailModal";
import JTCard from "../ui/JTCard";
import JTButton from "../ui/JTButton";
import JTSkeleton from "../ui/JTSkeleton";
import JTEmptyState from "../ui/JTEmptyState";

function TimelineModule({ currentProfile, currentUser, triggerDoctorReportPrint, onOpenEventMarker }) {
  const { scans, timelineItems, loading } = useTimelineData();
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Firestore는 최신순(desc)으로 오므로 그래프용으로 오래된 순으로 뒤집고,
  // createdAt(Firestore Timestamp)을 사람이 읽는 날짜 라벨로 변환.
  // scans 문서는 이제 { metrics, scores } 계층 구조 — raw 서브컬렉션은 여기서 전혀 조회하지 않는다.
  const chartData = [...scans].reverse().map(s => ({
    week: s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "-",
    pain: s.metrics?.painIndex ?? 0,
    rom: s.scores?.total ?? 0,
  }));

  const hasRealData = chartData.length >= 2;
  const latestScore = scans[0]?.scores?.total;
  const earliestScore = scans[scans.length - 1]?.scores?.total;
  const realWeeklyChange = (hasRealData && latestScore != null && earliestScore != null)
    ? `${latestScore >= earliestScore ? "+" : ""}${latestScore - earliestScore}점 (Finger Health Score 변화)`
    : null;

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Recovery Progress</p>
        <h2 className="text-sm font-bold text-slate-900">관절 가동 범위(ROM) & 통증 감소 추이</h2>
      </div>

      <JTButton variant="outline" icon={Plus} onClick={() => onOpenEventMarker?.()}>
        기록 추가
      </JTButton>

      <JTCard>
        <h4 className="text-xs font-bold text-slate-900 mb-2">전체 기록</h4>
        {loading ? (
          <JTSkeleton height={32} count={2} />
        ) : timelineItems.length === 0 ? (
          <JTEmptyState variant="compact" description="아직 기록이 없습니다. 스캔을 하거나 기록을 추가해보세요." />
        ) : (
          <div className="space-y-1">
            {timelineItems.map((item) => {
              const Icon = getTimelineIcon(item);
              const isEvent = item.kind === "event";
              const Row = isEvent ? "button" : "div";
              return (
                <Row key={`${item.kind}-${item.id}`}
                  onClick={isEvent ? () => setSelectedEvent(item) : undefined}
                  className={`w-full flex items-center gap-2 text-[11px] text-slate-700 py-1.5 ${isEvent ? "text-left hover:bg-slate-50 rounded-lg -mx-1 px-1" : ""}`}>
                  <span className="text-slate-400 shrink-0 w-14">{formatTimelineDate(item.date)}</span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${item.kind === "scan" ? "text-blue-500" : "text-orange-500"}`} />
                  <span className="truncate">{item.label}{item.kind === "scan" && item.scoreTotal != null ? ` (${item.scoreTotal}점)` : ""}</span>
                </Row>
              );
            })}
          </div>
        )}
      </JTCard>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} scans={scans} uid={currentUser?.uid} onClose={() => setSelectedEvent(null)} />
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-[10px] text-slate-400">스캔 기록을 불러오는 중...</p>
        </div>
      ) : !hasRealData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-amber-700">아직 데이터가 충분하지 않습니다</p>
          <p className="text-[10px] text-amber-600 mt-1 leading-relaxed">
            모션스캔을 2회 이상 진행하면 실제 스캔 기록을 바탕으로 한 추이 그래프가 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-blue-700 mb-2">실제 스캔 기록 — 통증 지수(VAS) 추이</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{fontSize:8}} />
                  <YAxis tick={{fontSize:8}} domain={[0,10]} />
                  <ChartTooltip contentStyle={{fontSize:"10px"}} />
                  <Area type="monotone" dataKey="pain" stroke="#ef4444" fill="#fee2e2" name="통증(VAS)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-blue-700 mb-2">실제 스캔 기록 — Finger Score™ 추이</p>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{fontSize:8}} />
                  <YAxis tick={{fontSize:8}} domain={[0,100]} />
                  <ChartTooltip contentStyle={{fontSize:"10px"}} />
                  <Bar dataKey="rom" name="Finger Score" radius={[4,4,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#3b82f6" : "#bfdbfe"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
        <p className="text-[10px] font-bold text-blue-800 mb-2">
          주간 회복 변화: <span className="text-blue-600">{realWeeklyChange || currentProfile.weeklyROMChange}</span>
        </p>
        <button onClick={triggerDoctorReportPrint} className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 mx-auto">
          <Printer className="w-3.5 h-3.5" /> 소견서 출력
        </button>
      </div>
    </div>
  );
}

export default TimelineModule;

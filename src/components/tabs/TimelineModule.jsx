import { useState, useEffect } from "react";
import { Printer, Plus } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as ChartTooltip, BarChart, Bar, Cell
} from "recharts";
import { getScanHistory, getEventHistory } from "../../lib/firestore";
import { mergeScansAndEvents, formatTimelineDate } from "../../lib/mergeTimeline";

function TimelineModule({ currentProfile, currentUser, triggerDoctorReportPrint, triggerFeedback, onOpenEventMarker }) {
  const [scans, setScans] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!currentUser) { setLoading(false); return; }
      try {
        const [scanRows, eventRows] = await Promise.all([
          getScanHistory(currentUser.uid, 30),
          getEventHistory(currentUser.uid, 30),
        ]);
        if (!cancelled) { setScans(scanRows); setEvents(eventRows); }
      } catch (err) {
        console.error("[JOINTRUN] 타임라인 기록 조회 실패:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // scans(측정 기록) + events(행동 기록) 병합 리스트 — 별도의 ACTION 화면 없이 하나의 시간순 리스트로 통합.
  const timelineItems = mergeScansAndEvents(scans, events);

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

      <button onClick={() => onOpenEventMarker?.()}
        className="w-full bg-white border border-dashed border-blue-300 text-blue-600 text-xs font-bold py-2.5 rounded-2xl flex items-center justify-center gap-1.5">
        <Plus className="w-4 h-4" />기록 추가
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 mb-2">전체 기록</h4>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : timelineItems.length === 0 ? (
          <p className="text-[10px] text-slate-400 py-2">아직 기록이 없습니다. 스캔을 하거나 기록을 추가해보세요.</p>
        ) : (
          <div className="space-y-1.5">
            {timelineItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-[11px] text-slate-700 py-0.5">
                <span className="text-slate-400 shrink-0 w-14">{formatTimelineDate(item.date)}</span>
                <span className={item.kind === "scan" ? "text-blue-500" : "text-orange-500"}>●</span>
                <span className="truncate">{item.label}{item.kind === "scan" && item.scoreTotal != null ? ` (${item.scoreTotal}점)` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

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

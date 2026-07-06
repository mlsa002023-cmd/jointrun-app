import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as ChartTooltip, BarChart, Bar, Cell
} from "recharts";
import { getScanHistory } from "../../lib/firestore";

function TimelineModule({ currentProfile, currentUser, triggerDoctorReportPrint, triggerFeedback }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!currentUser) { setLoading(false); return; }
      try {
        const rows = await getScanHistory(currentUser.uid, 30);
        if (!cancelled) setScans(rows);
      } catch (err) {
        console.error("[JOINTRUN] 스캔 기록 조회 실패:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Firestore는 최신순(desc)으로 오므로 그래프용으로 오래된 순으로 뒤집고,
  // createdAt(Firestore Timestamp)을 사람이 읽는 날짜 라벨로 변환.
  const chartData = [...scans].reverse().map(s => ({
    week: s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "-",
    pain: s.painIndex ?? 0,
    rom: s.avgScore ?? 0,
  }));

  const hasRealData = chartData.length >= 2;
  const latestScore = scans[0]?.avgScore;
  const earliestScore = scans[scans.length - 1]?.avgScore;
  const realWeeklyChange = (hasRealData && latestScore != null && earliestScore != null)
    ? `${latestScore >= earliestScore ? "+" : ""}${latestScore - earliestScore}점 (Finger Score 변화)`
    : null;

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Recovery Progress</p>
        <h2 className="text-sm font-bold text-slate-900">관절 가동 범위(ROM) & 통증 감소 추이</h2>
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
            <p className="text-[10px] font-bold text-teal-700 mb-2">실제 스캔 기록 — 통증 지수(VAS) 추이</p>
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
            <p className="text-[10px] font-bold text-teal-700 mb-2">실제 스캔 기록 — Finger Score™ 추이</p>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{fontSize:8}} />
                  <YAxis tick={{fontSize:8}} domain={[0,100]} />
                  <ChartTooltip contentStyle={{fontSize:"10px"}} />
                  <Bar dataKey="rom" name="Finger Score" radius={[4,4,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#14b8a6" : "#99f6e4"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
        <p className="text-[10px] font-bold text-teal-800 mb-2">
          주간 회복 변화: <span className="text-teal-600">{realWeeklyChange || currentProfile.weeklyROMChange}</span>
        </p>
        <button onClick={triggerDoctorReportPrint} className="bg-teal-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 mx-auto">
          <Printer className="w-3.5 h-3.5" /> 소견서 출력
        </button>
      </div>
    </div>
  );
}

export default TimelineModule;

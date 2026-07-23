import { useEffect } from "react";
import { X } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip } from "recharts";
import { computeEventComparison } from "../lib/eventComparison";
import { formatTimelineDate } from "../lib/mergeTimeline";
import { trackKpiEvent } from "../lib/analytics";
import { FEATURE_FLAGS } from "../config/featureFlags";

// Decision Log 드릴다운 — 이벤트 전후 N주 Finger Score를 비교하는 미니 그래프(작업지시서 §6.1).
// 관찰된 평균만 서술한다 — 원인 진단이나 행동 권고 문구는 넣지 않는다(§5.2 카피 가이드라인 공유).
function EventDetailModal({ event, scans, uid, onClose }) {
  const { before, after, beforeAvg, afterAvg, hasEnoughData, windowWeeks } = computeEventComparison(event, scans);

  // history_comparison_viewed(§8) — 실제로 전후 비교가 표시된 경우에만, 이벤트당 1회 발생(데이터 부족 안내는 제외).
  useEffect(() => {
    if (hasEnoughData) trackKpiEvent("history_comparison_viewed", uid, { eventType: event.type });
  }, [event.id]);

  const chartData = [
    ...before.map((s) => ({ dayOffset: Math.round((s.date.getTime() - event.date.getTime()) / 86400000), before: s.score, after: null })),
    ...after.map((s) => ({ dayOffset: Math.round((s.date.getTime() - event.date.getTime()) / 86400000), before: null, after: s.score })),
  ].sort((a, b) => a.dayOffset - b.dayOffset);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{event.label}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatTimelineDate(event.date)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400" style={{ minHeight: 44, minWidth: 44 }}>
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {!hasEnoughData ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-amber-700">비교할 측정 기록이 더 필요합니다</p>
            <p className="text-[10px] text-amber-600 mt-1 leading-relaxed">
              이 기록 전후 {windowWeeks}주 이내에 스캔 기록이 더 있으면 변화를 비교해서 보여드려요.
            </p>
          </div>
        ) : !FEATURE_FLAGS.legacyScoreExperiment ? (
          // V9 정렬(JR-WEB-202) — 절대 점수 기반 전후 비교는 숨긴다. 기준선 대비 비교 화면
          // (ComparisonScreen, 04_APP_PRD_V9.md S09)이 Decision Log와 연결되면 이 자리를 대체한다.
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              이 기록 전후 비교는 기준선 기반 비교 화면으로 통합될 예정입니다.
            </p>
          </div>
        ) : (
          <>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dayOffset" tick={{ fontSize: 8 }} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}일`} />
                  <YAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                  <ChartTooltip contentStyle={{ fontSize: "10px" }} labelFormatter={(v) => `${v > 0 ? "+" : ""}${v}일`} />
                  <Line type="monotone" dataKey="before" name="이전" stroke="#94a3b8" connectNulls dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="after" name="이후" stroke="#3b82f6" connectNulls dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-3 text-center">
              <p className="text-[11px] text-slate-700">
                이 기록 전 평균 <span className="font-bold text-slate-500">{beforeAvg.toFixed(0)}점</span>
                {" · "}
                이 기록 후 평균 <span className="font-bold text-blue-600">{afterAvg.toFixed(0)}점</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EventDetailModal;

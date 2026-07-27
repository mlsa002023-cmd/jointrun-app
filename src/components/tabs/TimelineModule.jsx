import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as ChartTooltip, BarChart, Bar, Cell
} from "recharts";
import { formatTimelineDate } from "../../lib/mergeTimeline";
import { formatDateValue } from "../../lib/dateValue";
import { getTimelineIcon } from "../../lib/eventIcons";
import { useTimelineData } from "../../hooks/useTimelineData";
import { useV9Repository } from "../../hooks/useV9Repository";
import { computeObservationTimepoints } from "../../lib/observationTrend";
import { FEATURE_FLAGS, shouldShowQaTools } from "../../config/featureFlags";
import DecisionLoopTimeline from "../v9/DecisionLoopTimeline";
import EventDetailModal from "../EventDetailModal";
import JTButton from "../ui/JTButton";
import JTSection from "../ui/JTSection";
import JTSkeleton from "../ui/JTSkeleton";
import JTEmptyState from "../ui/JTEmptyState";

const HAND_LABEL = { left: "왼손", right: "오른손" };
const TIMEPOINT_LABEL = { baseline: "첫 기준선", recheck: "재확인" };

// FIX-1 §5 — V9 기준선·재확인 capture(같은 handSide·같은 poseProtocolVersion, 2시점 이상)만으로
// 관찰 추이 시점을 보여준다. 새 점수·의학적 변화 판정은 하지 않는다(관찰형 나열만).
function ObservationTrendSection({ details }) {
  if (details === null) {
    return (
      <JTSection title="관찰 추이">
        <JTSkeleton height={28} count={2} />
      </JTSection>
    );
  }
  const { available, handSide, timepoints } = computeObservationTimepoints(details);
  return (
    <JTSection title="관찰 추이">
      {!available ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            같은 측정 방식으로 기준선과 재확인을 기록하면 관찰 추이가 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <p className="text-[10px] text-slate-500 mb-2">
            같은 방식({HAND_LABEL[handSide] ?? "손"})으로 기록된 관찰 시점 {timepoints.length}개
          </p>
          <div className="space-y-1">
            {timepoints.map((tp, i) => (
              <div key={`${tp.eventId}-${i}`} className="flex items-center gap-2 text-[11px] text-slate-700 py-0.5">
                <span className="text-slate-400 shrink-0 w-14">{formatDateValue(tp.capturedAt)}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="truncate">{TIMEPOINT_LABEL[tp.type] ?? tp.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </JTSection>
  );
}

function TimelineModule({ currentProfile, currentUser, onOpenEventMarker }) {
  const { scans, timelineItems, loading } = useTimelineData();
  const repository = useV9Repository();
  const [selectedEvent, setSelectedEvent] = useState(null);
  // FIX-1 §5 — getHistoryDetailed를 이 상위에서 한 번만 조회해 DecisionLoopTimeline과
  // 관찰 추이가 함께 쓴다(중복 Firestore 조회 방지). null = 아직 로딩 중.
  const [details, setDetails] = useState(null);
  const qaVisible = shouldShowQaTools(currentUser);
  const showLegacyScoreCharts = FEATURE_FLAGS.absoluteScoreUiEnabled || qaVisible;

  useEffect(() => {
    let cancelled = false;
    repository.getHistoryDetailed(5).then((rows) => {
      if (!cancelled) setDetails((rows ?? []).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [repository]);

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
        <p className="text-[9px] text-slate-400 uppercase font-mono">Decision Loop</p>
        <h2 className="text-sm font-bold text-slate-900">판단 기록 타임라인</h2>
      </div>
      <DecisionLoopTimeline details={details} />

      <ObservationTrendSection details={details} />

      <JTButton variant="outline" icon={Plus} onClick={() => onOpenEventMarker?.()}>
        기록 추가
      </JTButton>

      <JTSection title="전체 기록">
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
                  <span className="truncate">{item.label}{FEATURE_FLAGS.absoluteScoreUiEnabled && item.kind === "scan" && item.scoreTotal != null ? ` (${item.scoreTotal}점)` : ""}</span>
                </Row>
              );
            })}
          </div>
        )}
      </JTSection>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} scans={scans} uid={currentUser?.uid} onClose={() => setSelectedEvent(null)} />
      )}

      {/* FIX-1 §5 — 레거시 scans 기반 그래프(통증 VAS·Finger Score)는 absoluteScoreUiEnabled 또는
          QA 내부에서만 유지한다. production 기본 사용자에게는 위 '관찰 추이'가 대신 표시된다. */}
      {showLegacyScoreCharts && (
      <>
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
            같은 방식으로 기준선과 재확인을 기록하면, 시점별 관찰 변화가 여기에 표시됩니다.
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
          {FEATURE_FLAGS.absoluteScoreUiEnabled && (
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
          )}
        </>
      )}

      {FEATURE_FLAGS.absoluteScoreUiEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
          <p className="text-[10px] font-bold text-blue-800 mb-2">
            주간 회복 변화: <span className="text-blue-600">{realWeeklyChange || currentProfile.weeklyROMChange}</span>
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default TimelineModule;

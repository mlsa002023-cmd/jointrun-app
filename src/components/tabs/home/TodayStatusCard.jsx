import { ChevronRight } from "lucide-react";
import { FEATURE_FLAGS } from "../../../config/featureFlags";

// RC1.2 §4 — production 기본(absoluteScoreUiEnabled=false)에서는 "오늘의 정밀 지표 / Finger Score"
// 진입 카드를 노출하지 않고, V10 변화 기록(Timeline) 진입 카드로 대체한다.
// 레거시 점수 진입은 내부 flag가 켜진 경우에만 유지한다.
function TodayStatusCard({ setActiveTab }) {
  if (FEATURE_FLAGS.absoluteScoreUiEnabled) {
    return (
      <button onClick={() => setActiveTab("report")}
        className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
        <div className="text-left">
          <h4 className="text-xs font-bold text-slate-900">오늘의 정밀 지표</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Finger Score 등 자세히 보기</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
    );
  }

  return (
    <button onClick={() => setActiveTab("timeline")}
      className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
      <div className="text-left">
        <h4 className="text-xs font-bold text-slate-900">내 변화 기록</h4>
        <p className="text-[10px] text-slate-400 mt-0.5">기준선·재확인·선택·결과를 시간순으로 확인하세요</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  );
}

export default TodayStatusCard;

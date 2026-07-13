import { ChevronRight } from "lucide-react";

// "오늘의 정밀 지표" 진입 카드 — Finger Score 원점수는 첫 화면에 노출하지 않고(작업지시서 §5.1),
// 탭해야 볼 수 있는 하위 화면(REPORT 탭)으로 안내만 한다.
function TodayStatusCard({ setActiveTab }) {
  return (
    <button onClick={() => setActiveTab("report")}
      className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
      <div className="text-left">
        <h4 className="text-xs font-bold text-slate-900">오늘의 정밀 지표</h4>
        <p className="text-[10px] text-slate-400 mt-0.5">Finger Score, 관절 기능 나이 등 자세히 보기</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  );
}

export default TodayStatusCard;

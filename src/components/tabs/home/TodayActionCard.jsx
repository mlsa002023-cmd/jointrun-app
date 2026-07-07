import { getTodayAction } from "../../../lib/getTodayAction";

// "오늘의 행동" 카드 — Rule-Based Recommendation Engine(getTodayAction) 결과를 보여준다.
function TodayActionCard({ profile, swellingLevel, consistencyScore, mobilityTrendUp }) {
  const action = getTodayAction({ name: profile.name, swellingLevel, consistencyScore, mobilityTrendUp });
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 행동</h4>
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-[10px] text-slate-700 leading-relaxed">
        {action.message}
      </div>
      <p className="text-[8px] text-slate-400 mt-1">{action.reason}</p>
    </div>
  );
}

export default TodayActionCard;

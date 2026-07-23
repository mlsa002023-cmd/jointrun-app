import { getTodayAction } from "../../../lib/getTodayAction";
import { FEATURE_FLAGS } from "../../../config/featureFlags";

// "오늘의 행동" 카드 — Rule-Based Recommendation Engine(getTodayAction) 결과를 보여준다.
// V9 정렬(04_APP_PRD_V9.md 비목표: "자동 관리 추천") — 자동 추천 문구는 absoluteScoreUiEnabled
// 플래그 뒤로 숨긴다. 대체 UI(사용자의 선택 기록 = Decision Log)는 P1에서 별도 구현한다.
function TodayActionCard({ profile, swellingLevel, consistencyScore, mobilityTrendUp }) {
  if (!FEATURE_FLAGS.absoluteScoreUiEnabled) return null;
  const action = getTodayAction({ name: profile.name, swellingLevel, consistencyScore, mobilityTrendUp });
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 행동</h4>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-[10px] text-slate-700 leading-relaxed">
        {action.message}
      </div>
      <p className="text-[8px] text-slate-400 mt-1">{action.reason}</p>
    </div>
  );
}

export default TodayActionCard;

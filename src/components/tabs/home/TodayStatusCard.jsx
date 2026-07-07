// "오늘의 상태" 카드 — Finger Health Score 게이지 + 관절 기능 나이.
function TodayStatusCard({ profile }) {
  const score = profile.fingerHealthScore;
  return (
    <div className="bg-gradient-to-br from-teal-50 to-slate-50 border border-teal-200 rounded-2xl p-3.5 shadow-sm">
      <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 상태</h4>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[9px] text-slate-400 uppercase font-mono">Finger Score™</p>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-black text-teal-700 font-mono">{score}</span>
            <span className="text-xs text-slate-500 mb-0.5">/100</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-400">관절 기능 나이</p>
          <p className="text-lg font-black text-slate-800 font-mono">{profile.fingerAge}<span className="text-xs font-normal">세</span></p>
        </div>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${score}%` }} />
      </div>
      <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
        <span>주의</span><span>양호</span><span>최상</span>
      </div>
    </div>
  );
}

export default TodayStatusCard;

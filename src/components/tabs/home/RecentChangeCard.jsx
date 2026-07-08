// "최근 변화" 카드 (Normal 상태 전용) — 직전 스캔 대비 Finger Health Score 증감만 보여준다.
// 7일 평균/30일 추세 같은 통계는 이번 이식 범위가 아님 — 회복추이·리포트 화면 몫으로 남겨둔다.
function RecentChangeCard({ recentChange }) {
  const delta = recentChange?.delta;
  const positive = delta != null && delta >= 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <h4 className="text-xs font-bold text-slate-900 mb-1">최근 변화</h4>
      {delta != null ? (
        <p className="text-[11px] text-slate-700">
          직전 스캔 대비 <span className={`font-bold ${positive ? "text-blue-600" : "text-red-500"}`}>{positive ? "+" : ""}{delta}점</span>
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">아직 비교할 데이터가 부족해요.</p>
      )}
    </div>
  );
}

export default RecentChangeCard;

// "오늘의 행동" 카드 — 지금은 자리만 채워두는 문구.
// TODO(8단계 Recommendation Engine): getTodayAction()의 Rule-Based 결과로 교체한다.
function TodayActionCard({ profile }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <h4 className="text-xs font-bold text-slate-900 mb-2">오늘의 행동</h4>
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-[10px] text-slate-700 leading-relaxed">
        {profile.painIndex > 6
          ? `${profile.name} 님, 오늘 통증 수치가 높습니다. 무리한 손 사용을 줄이고 3분 온수 잼잼 요법을 즉시 시작해 주세요.`
          : `${profile.name} 님, 오늘 관절 상태가 안정적입니다. 스마트 보조기를 착용한 채로 가볍게 20초 스캔을 진행해 회복 데이터를 누적해 보세요.`}
      </div>
    </div>
  );
}

export default TodayActionCard;

// First Scan 상태 전용 — 비교할 이전 기록이 없다는 것을 명확히 안내(빈 화면처럼 보이지 않게).
function FirstScanNotice() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 shadow-sm text-center">
      <h4 className="text-xs font-bold text-amber-800 mb-1">최근 변화</h4>
      <p className="text-[11px] text-amber-700">내일 다시 측정하면 변화를 확인할 수 있습니다.</p>
    </div>
  );
}

export default FirstScanNotice;

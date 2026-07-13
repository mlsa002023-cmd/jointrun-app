import { computeRelativeChangeMessage } from "../../../lib/relativeChange";

// "최근 변화" 카드 — 절대 점수 대신 관찰된 변화만 문장으로 보여준다(작업지시서 §5.1).
// 데이터 3회 미만이면 안내 문구로 대체하고, 3회 이상이면 rolling window 비교 결과를 보여준다.
function RelativeChangeCard({ scans }) {
  const { status, message } = computeRelativeChangeMessage(scans);
  const toneClass =
    status === "worsening"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : status === "insufficient"
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={`border rounded-2xl p-3.5 shadow-sm ${toneClass}`}>
      <h4 className="text-xs font-bold mb-1">최근 변화</h4>
      <p className="text-[12px] leading-relaxed">{message}</p>
    </div>
  );
}

export default RelativeChangeCard;

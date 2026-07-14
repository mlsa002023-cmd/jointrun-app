// 화면 전반에 13회 이상 반복되던 카드 마크업(bg-white border rounded-2xl shadow-sm)의 단일 출처.
// tone은 RelativeChangeCard/PatternInsightCard 같은 관찰 상태 카드에서 쓰는 색 배경 변형.
const TONE_CLASSES = {
  default: "bg-white border-slate-200",
  muted: "bg-slate-50 border-slate-200",
  info: "bg-blue-50 border-blue-200",
  warning: "bg-amber-50 border-amber-200",
};

function JTCard({ tone = "default", padding = "p-3", className = "", children, ...rest }) {
  return (
    <div className={`border rounded-2xl shadow-sm ${TONE_CLASSES[tone]} ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default JTCard;

import JTCard from "./ui/JTCard";
import { PatternDetector } from "../domain/PatternDetector";

// "패턴 관찰" 카드 — HOME과 REPORT 양쪽에서 재사용(작업지시서 §7.1).
// getTodayAction의 "오늘의 행동" 추천과는 별개로, 최근 기록의 관찰 사실만 보여준다.
// 판정은 PatternDetector(도메인 서비스)에게만 맡긴다 — 여기서 새 판정 로직을 만들지 않는다.
function PatternInsightCard({ scans }) {
  const { status, message } = PatternDetector.detect(scans);
  const tone = status === "insufficient" ? "muted" : status === "stable" ? "info" : "warning";
  const textClass =
    status === "declining" ? "text-amber-800"
    : status === "volatile" ? "text-amber-700"
    : status === "insufficient" ? "text-slate-500"
    : "text-blue-800";

  return (
    <JTCard tone={tone} className={textClass}>
      <h4 className="text-xs font-bold mb-1">패턴 관찰</h4>
      <p className="text-[11px] leading-relaxed">{message}</p>
    </JTCard>
  );
}

export default PatternInsightCard;

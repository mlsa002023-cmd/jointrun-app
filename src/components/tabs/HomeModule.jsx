import { Camera } from "lucide-react";
import TodayActionCard from "./home/TodayActionCard";
import TodayStatusCard from "./home/TodayStatusCard";
import RelativeChangeCard from "./home/RelativeChangeCard";
import PatternInsightCard from "../PatternInsightCard";
import RecordSection from "./home/RecordSection";
import RecentTimelinePreview from "./home/RecentTimelinePreview";
import JTButton from "../ui/JTButton";

// Normal State — Claude Design HOME Wireframe(Deliverable 3) 기준 재배치(작업지시서 STEP 2):
// 오늘 상태 진입 → 최근 변화(상대 비교, 원점수 비노출) → Timeline 미리보기 → 오늘의 관찰(패턴+행동)
// → 기록하기(체크인/회복 미션) → 스캔(최하단, Secondary 톤).
function HomeModule(props) {
  const { currentProfile, scans, setActiveTab, swellingLevel, consistencyScore, mobilityTrendUp } = props;
  return (
    <div className="space-y-4">
      <TodayStatusCard setActiveTab={setActiveTab} />
      <RelativeChangeCard scans={scans} />
      <RecentTimelinePreview setActiveTab={setActiveTab} />
      <PatternInsightCard scans={scans} />
      <TodayActionCard profile={currentProfile} swellingLevel={swellingLevel} consistencyScore={consistencyScore} mobilityTrendUp={mobilityTrendUp} />
      <RecordSection {...props} />
      <JTButton variant="outline" icon={Camera} onClick={() => setActiveTab("scan")}>
        30초 스캔 시작하기
      </JTButton>
    </div>
  );
}

export default HomeModule;

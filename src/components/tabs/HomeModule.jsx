import TodayActionCard from "./home/TodayActionCard";
import TodayStatusCard from "./home/TodayStatusCard";
import RelativeChangeCard from "./home/RelativeChangeCard";
import PatternInsightCard from "../PatternInsightCard";
import RecordSection from "./home/RecordSection";

// Normal State — 데이터 2개 이상. 최근 변화(상대 비교, 원점수 비노출) → 패턴 관찰 → 오늘의 행동 → 정밀 지표 진입 → 기록하기.
function HomeModule(props) {
  const { currentProfile, scans, setActiveTab, swellingLevel, consistencyScore, mobilityTrendUp } = props;
  return (
    <div className="space-y-4">
      <RelativeChangeCard scans={scans} />
      <PatternInsightCard scans={scans} />
      <TodayActionCard profile={currentProfile} swellingLevel={swellingLevel} consistencyScore={consistencyScore} mobilityTrendUp={mobilityTrendUp} />
      <TodayStatusCard setActiveTab={setActiveTab} />
      <RecordSection {...props} />
    </div>
  );
}

export default HomeModule;

import TodayActionCard from "./home/TodayActionCard";
import TodayStatusCard from "./home/TodayStatusCard";
import RecentChangeCard from "./home/RecentChangeCard";
import RecordSection from "./home/RecordSection";

// Normal State — 데이터 2개 이상. 오늘의 행동 → 오늘의 상태 → 최근 변화 → 기록하기.
function HomeModule(props) {
  const { currentProfile, recentChange, swellingLevel, consistencyScore, mobilityTrendUp } = props;
  return (
    <div className="space-y-4">
      <TodayActionCard profile={currentProfile} swellingLevel={swellingLevel} consistencyScore={consistencyScore} mobilityTrendUp={mobilityTrendUp} />
      <TodayStatusCard profile={currentProfile} />
      <RecentChangeCard recentChange={recentChange} />
      <RecordSection {...props} />
    </div>
  );
}

export default HomeModule;

import TodayActionCard from "./TodayActionCard";
import TodayStatusCard from "./TodayStatusCard";
import RelativeChangeCard from "./RelativeChangeCard";
import RecordSection from "./RecordSection";

// First Scan State — 데이터 1개. RelativeChangeCard가 스캔 1개일 때 자동으로 "비교 대상 부족" 안내를 보여준다.
// 체크인/회복 미션은 Normal과 동일하게 유지한다.
function FirstScanHomeState(props) {
  const { currentProfile, scans, setActiveTab, swellingLevel, consistencyScore, mobilityTrendUp } = props;
  return (
    <div className="space-y-4">
      <RelativeChangeCard scans={scans} />
      <TodayActionCard profile={currentProfile} swellingLevel={swellingLevel} consistencyScore={consistencyScore} mobilityTrendUp={mobilityTrendUp} />
      <TodayStatusCard setActiveTab={setActiveTab} />
      <RecordSection {...props} />
    </div>
  );
}

export default FirstScanHomeState;

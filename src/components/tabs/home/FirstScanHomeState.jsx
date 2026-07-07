import TodayActionCard from "./TodayActionCard";
import TodayStatusCard from "./TodayStatusCard";
import FirstScanNotice from "./FirstScanNotice";
import RecordSection from "./RecordSection";

// First Scan State — 데이터 1개. 오늘의 상태는 보여주되 "최근 변화"는 비교 대상이 없다는 안내로 대체.
// 체크인/회복 미션은 Normal과 동일하게 유지한다.
function FirstScanHomeState(props) {
  const { currentProfile } = props;
  return (
    <div className="space-y-4">
      <TodayActionCard profile={currentProfile} />
      <TodayStatusCard profile={currentProfile} />
      <FirstScanNotice />
      <RecordSection {...props} />
    </div>
  );
}

export default FirstScanHomeState;

import { Camera } from "lucide-react";
import JTEmptyState from "../../ui/JTEmptyState";

// Empty State — 데이터 0개. 5초 안에 "뭘 해야 하는지" 이해할 수 있도록 게이지/체크인/미션 전부 걷어내고 CTA 하나만 남긴다.
function EmptyHomeState({ currentProfile, setActiveTab }) {
  return (
    <JTEmptyState
      variant="full"
      icon={Camera}
      title={`${currentProfile.name} 님, 아직 기록이 없어요`}
      description={<>첫 스캔을 하면 오늘의 손 건강이 분석됩니다.<br />20초면 충분해요.</>}
      actionLabel="첫 스캔 시작하기"
      onAction={() => setActiveTab("scan")}
    />
  );
}

export default EmptyHomeState;

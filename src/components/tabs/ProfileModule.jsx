import { useState } from "react";
import { CreditCard, ExternalLink, LogOut, MessageSquare } from "lucide-react";
import JTCard from "../ui/JTCard";
import JTListItem from "../ui/JTListItem";
import JTButton from "../ui/JTButton";
import PricingScreen from "../v9/PricingScreen";
import { FEATURE_FLAGS } from "../../config/featureFlags";

// PROFILE 탭 — 설정 + 기존에 하단 탭을 차지하던 AI코치/커뮤니티 진입점을 모아둔다.
// SCAN 화면과 마찬가지로 이 항목들의 내부 로직 자체는 바꾸지 않는다(진입점만 재배치).
function ProfileModule({ currentProfile, onEditConcernArea, onOpenCoach, communityUrl, logout }) {
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div className="space-y-4">
      {showPricing && <PricingScreen onClose={() => setShowPricing(false)} />}
      <JTCard padding="p-4" className="text-center">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Profile</p>
        <h2 className="text-sm font-bold text-slate-900">{currentProfile.name} 님</h2>
      </JTCard>

      <JTCard padding="p-1" className="divide-y divide-slate-100">
        <JTListItem as="button" onClick={onEditConcernArea} showChevron
          label="비진단 안내 다시 보기" sublabel={currentProfile.concernArea ? "확인 완료" : "미확인"} />
        <JTListItem as="button" onClick={onOpenCoach} icon={MessageSquare} showChevron
          label="기록 도우미와 대화하기" />
        <JTListItem as="button" onClick={() => window.open(communityUrl, "_blank", "noopener,noreferrer")} icon={ExternalLink} showChevron
          label="커뮤니티 (네이버 밴드)" />
        {/* S16 요금제 — pricingExperiment 플래그가 꺼져 있으면(기본값) 진입점 자체가 없다. */}
        {FEATURE_FLAGS.pricingExperiment && (
          <JTListItem as="button" onClick={() => setShowPricing(true)} icon={CreditCard} showChevron
            label="요금제" />
        )}
      </JTCard>

      <JTButton variant="ghost" icon={LogOut} onClick={logout}>
        로그아웃
      </JTButton>
    </div>
  );
}

export default ProfileModule;

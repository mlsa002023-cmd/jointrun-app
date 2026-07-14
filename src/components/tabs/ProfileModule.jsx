import { ExternalLink, LogOut, MessageSquare } from "lucide-react";
import JTCard from "../ui/JTCard";
import JTListItem from "../ui/JTListItem";
import JTButton from "../ui/JTButton";

// PROFILE 탭 — 설정 + 기존에 하단 탭을 차지하던 AI코치/커뮤니티 진입점을 모아둔다.
// SCAN 화면과 마찬가지로 이 항목들의 내부 로직 자체는 바꾸지 않는다(진입점만 재배치).
function ProfileModule({ currentProfile, onEditConcernArea, onOpenCoach, communityUrl, logout }) {
  return (
    <div className="space-y-4">
      <JTCard padding="p-4" className="text-center">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Profile</p>
        <h2 className="text-sm font-bold text-slate-900">{currentProfile.name} 님</h2>
      </JTCard>

      <JTCard padding="p-1" className="divide-y divide-slate-100">
        <JTListItem as="button" onClick={onEditConcernArea} showChevron
          label="걱정 부위 다시 설정" sublabel={`현재: ${currentProfile.concernArea || "미설정"}`} />
        <JTListItem as="button" onClick={onOpenCoach} icon={MessageSquare} showChevron
          label="AI 코치와 대화하기" />
        <JTListItem as="button" onClick={() => window.open(communityUrl, "_blank", "noopener,noreferrer")} icon={ExternalLink} showChevron
          label="커뮤니티 (네이버 밴드)" />
      </JTCard>

      <JTButton variant="ghost" icon={LogOut} onClick={logout}>
        로그아웃
      </JTButton>
    </div>
  );
}

export default ProfileModule;

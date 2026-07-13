import { ChevronRight, ExternalLink, LogOut, MessageSquare } from "lucide-react";

// PROFILE 탭 — 설정 + 기존에 하단 탭을 차지하던 AI코치/커뮤니티 진입점을 모아둔다.
// SCAN 화면과 마찬가지로 이 항목들의 내부 로직 자체는 바꾸지 않는다(진입점만 재배치).
function ProfileModule({ currentProfile, onEditConcernArea, onOpenCoach, communityUrl, logout }) {
  const menuItemClass = "w-full min-h-11 flex items-center justify-between px-3 py-3 text-left";

  return (
    <div className="space-y-4">
      <div className="text-center bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <p className="text-[9px] text-slate-400 uppercase font-mono">Profile</p>
        <h2 className="text-sm font-bold text-slate-900">{currentProfile.name} 님</h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm divide-y divide-slate-100">
        <button onClick={onEditConcernArea} className={menuItemClass}>
          <div>
            <p className="text-xs font-bold text-slate-900">걱정 부위 다시 설정</p>
            <p className="text-[9px] text-slate-400 mt-0.5">현재: {currentProfile.concernArea || "미설정"}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button onClick={onOpenCoach} className={menuItemClass}>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-xs font-bold text-slate-900">AI 코치와 대화하기</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button onClick={() => window.open(communityUrl, "_blank", "noopener,noreferrer")} className={menuItemClass}>
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-xs font-bold text-slate-900">커뮤니티 (네이버 밴드)</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      <button onClick={logout} className="w-full bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500">
        <LogOut className="w-4 h-4" />로그아웃
      </button>
    </div>
  );
}

export default ProfileModule;

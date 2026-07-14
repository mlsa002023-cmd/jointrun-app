import { ChevronRight } from "lucide-react";

// ProfileModule 메뉴 항목 / Timeline 리스트 행에서 반복되던 "아이콘 + 라벨 + 트레일링" 패턴.
// as="button"이면 탭 가능한 행(예: Decision Log 이벤트), "div"면 정적 행(예: 스캔 기록).
function JTListItem({ as: As = "div", icon: Icon, label, sublabel, trailing, showChevron = false, className = "", ...rest }) {
  return (
    <As className={`w-full min-h-11 flex items-center justify-between px-3 py-3 text-left gap-2 ${className}`} {...rest}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-blue-500 shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">{label}</p>
          {sublabel && <p className="text-[9px] text-slate-400 mt-0.5 truncate">{sublabel}</p>}
        </div>
      </div>
      {trailing}
      {showChevron && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
    </As>
  );
}

export default JTListItem;

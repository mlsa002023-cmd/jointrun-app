// "compact"는 카드 안에 들어가는 한 줄 안내(Timeline/RecentTimelinePreview에서 쓰던 패턴),
// "full"은 화면 전체를 차지하는 히어로형 빈 상태(EmptyHomeState 패턴) — 5초 안에 무엇을 해야 하는지
// 이해시키기 위해 게이지/체크인/미션을 전부 걷어내고 CTA 하나만 남긴다는 기존 설계 의도를 그대로 따른다.
function JTEmptyState({ variant = "compact", icon: Icon, title, description, actionLabel, onAction }) {
  if (variant === "compact") {
    return <p className="text-[10px] text-slate-400 py-2">{description}</p>;
  }

  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 12px" }}>
      {Icon && (
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon style={{ width: 30, height: 30, color: "#1d4ed8" }} />
        </div>
      )}
      <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{title}</h2>
      {description && <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 24, maxWidth: 260 }}>{description}</p>}
      {actionLabel && (
        <button onClick={onAction} style={{ background: "#1d4ed8", color: "white", fontWeight: 800, fontSize: 13, padding: "12px 28px", borderRadius: 14, border: "none", cursor: "pointer" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default JTEmptyState;

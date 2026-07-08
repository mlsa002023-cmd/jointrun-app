import { Camera } from "lucide-react";

// Empty State — 데이터 0개. 5초 안에 "뭘 해야 하는지" 이해할 수 있도록 게이지/체크인/미션 전부 걷어내고 CTA 하나만 남긴다.
function EmptyHomeState({ currentProfile, setActiveTab }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px 12px" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Camera style={{ width: 30, height: 30, color: "#1d4ed8" }} />
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
        {currentProfile.name} 님, 아직 기록이 없어요
      </h2>
      <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 24, maxWidth: 260 }}>
        첫 스캔을 하면 오늘의 손 건강이 분석됩니다.<br />20초면 충분해요.
      </p>
      <button onClick={() => setActiveTab("scan")}
        style={{ background: "#1d4ed8", color: "white", fontWeight: 800, fontSize: 13, padding: "12px 28px", borderRadius: 14, border: "none", cursor: "pointer" }}>
        첫 스캔 시작하기
      </button>
    </div>
  );
}

export default EmptyHomeState;

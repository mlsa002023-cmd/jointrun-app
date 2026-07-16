// src/components/OnboardingScreen.jsx
// 회원가입 직후 1회 자동으로 뜨는 독립 온보딩 페이지 (기존 팝업 모달을 대체).
// 마이페이지의 "걱정 부위 다시 설정" 메뉴에서도 재방문해서 값을 수정할 수 있다 (그 경우 onCancel이 전달된다).

import { useState } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";

const CONCERN_OPTIONS = ["엄지", "끝마디", "손전체"];

export default function OnboardingScreen({ currentProfile, initialValue, onComplete, onCancel }) {
  const [selected, setSelected] = useState(initialValue || null);
  const isEditMode = Boolean(onCancel);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 24px 32px" }}>
      {isEditMode && (
        <button onClick={onCancel}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0", alignSelf: "flex-start" }}>
          <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
        </button>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ background: "#0f172a", color: "white", width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0 8px 20px rgba(15,23,42,0.25)" }}>
            <Sparkles style={{ width: 26, height: 26, color: "#93c5fd" }} />
          </div>
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginBottom: 6 }}>관심 부위 확인</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>
            {currentProfile?.name || "회원"} 님, 가장 걱정되는 부위는?
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {CONCERN_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => setSelected(opt)}
              style={{
                padding: "18px 4px",
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 800,
                border: selected === opt ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
                background: selected === opt ? "#eff6ff" : "white",
                color: selected === opt ? "#1d4ed8" : "#334155",
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
              {opt}
            </button>
          ))}
        </div>

        <button onClick={() => selected && onComplete(selected)} disabled={!selected}
          style={{ marginTop: 28, width: "100%", background: selected ? "#1d4ed8" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 800, cursor: selected ? "pointer" : "default" }}>
          {isEditMode ? "저장하기" : "시작하기"}
        </button>
      </div>
    </div>
  );
}

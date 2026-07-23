// 04_APP_PRD_V9.md S02 "판단 트리거 선택" — OnboardingScreen과 같은 독립 풀스크린 패턴을 따른다.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TRIGGER_TYPES } from "../../lib/triggerTypes";

export default function TriggerSelectScreen({ onSubmit, onCancel }) {
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState([]);

  const toggleSecondary = (value) => {
    setSecondary((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handlePrimarySelect = (value) => {
    setPrimary(value);
    setSecondary((prev) => prev.filter((v) => v !== value));
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 44 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginBottom: 6 }}>기록을 시작합니다</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", lineHeight: 1.35 }}>오늘 왜 기록하려고 하나요?</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
          주된 이유 1개를 먼저 골라주세요. 함께 해당하는 것이 있다면 추가로 선택할 수 있어요.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TRIGGER_TYPES.map((t) => {
          const isPrimary = primary === t.value;
          const isSecondary = secondary.includes(t.value);
          return (
            <button
              key={t.value}
              onClick={() => handlePrimarySelect(t.value)}
              style={{
                textAlign: "left",
                minHeight: 56,
                padding: "14px 16px",
                borderRadius: 14,
                border: isPrimary ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
                background: isPrimary ? "#eff6ff" : "white",
                color: isPrimary ? "#1d4ed8" : "#334155",
                fontSize: 15,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {t.label}
              {!isPrimary && primary && t.value !== "custom" && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggleSecondary(t.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleSecondary(t.value); } }}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                    border: isSecondary ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                    color: isSecondary ? "#1d4ed8" : "#94a3b8",
                    background: isSecondary ? "#eff6ff" : "transparent",
                  }}
                >
                  {isSecondary ? "함께 선택됨" : "함께 해당"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => primary && onSubmit({ primaryTrigger: primary, secondaryTriggers: secondary })}
        disabled={!primary}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: primary ? "#1d4ed8" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        다음
      </button>
    </div>
  );
}

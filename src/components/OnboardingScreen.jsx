// src/components/OnboardingScreen.jsx
// RC1.1 — Claude Design 원본 S01(가치 선언) + S02(개인정보·비진단 안내) 2단계로 재구성.
//
// 이전에는 "가장 걱정되는 부위"(엄지/끝마디/손전체)를 고르는 화면이었으나, V9 제품은 부위를
// 미리 고르게 하지 않는다(판단 트리거는 기록 시점에 S03에서 고른다). 디자인 원본에 맞춰
// S01 가치 선언 → S02 안내·동의 흐름으로 바꾼다.
//
// Firestore 스키마는 그대로 둔다(대표 지시: 기존 구조 보존) — 기존 `concernArea` 필드를
// "온보딩/안내 확인 완료" 표시로 계속 사용한다. 새 필드를 만들지 않는다.
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

// concernArea에 저장하는 값 — 이 값이 있으면 온보딩을 다시 띄우지 않는다.
export const ONBOARDING_DONE_VALUE = "안내 확인 완료";

const CONSENT_NOTES = [
  "의학적 진단이나 치료를 대신하지 않습니다.",
  "기록은 본인만 열람하며, 동의 없이 공유하지 않습니다.",
  "증상이 지속·악화되면 의료 전문가와 상담하세요.",
];

export default function OnboardingScreen({ onComplete, onCancel }) {
  const [step, setStep] = useState("intro"); // intro(S01) | consent(S02)
  const [agreed, setAgreed] = useState(false);
  const isEditMode = Boolean(onCancel);

  const backButton = (onBack) => (
    <button
      onClick={onBack}
      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0", alignSelf: "flex-start", minHeight: 48 }}
    >
      <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
    </button>
  );

  // ── S01 가치 선언 ──
  if (step === "intro") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F6FA", padding: "24px 24px 32px" }}>
        {isEditMode && backButton(onCancel)}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <img src="/brand/logo-mark.svg" alt="" width={56} height={56} style={{ marginBottom: 28 }} />
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#16213D", lineHeight: 1.35, margin: 0, letterSpacing: "-0.02em" }}>
            이 앱은 점수를 매기지 않습니다.
          </h1>
          <p style={{ fontSize: 17, color: "#5B6478", lineHeight: 1.6, marginTop: 16 }}>
            과거의 나와 비교해, 다음 행동을 판단할 근거만 남깁니다.
          </p>
        </div>

        <button
          onClick={() => setStep("consent")}
          style={{ width: "100%", minHeight: 48, background: "#122A5C", color: "white", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, cursor: "pointer" }}
        >
          시작하기
        </button>
      </div>
    );
  }

  // ── S02 개인정보·비진단 안내 ──
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", padding: "24px 24px 32px" }}>
      {backButton(() => setStep("intro"))}

      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#16213D", margin: "8px 0 24px", letterSpacing: "-0.02em" }}>
        기록 전, 꼭 알아두세요
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {CONSENT_NOTES.map((note) => (
          <div key={note} style={{ background: "#F4F6FA", borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 15, color: "#16213D", lineHeight: 1.6 }}>{note}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setAgreed((v) => !v)}
        aria-pressed={agreed}
        style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, background: "none", border: "none", padding: "6px 0", cursor: "pointer", minHeight: 48, alignSelf: "flex-start" }}
      >
        <span
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            border: `2px solid ${agreed ? "#1F9E96" : "#CBD1DC"}`,
            background: agreed ? "#1F9E96" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {agreed && <Check style={{ width: 16, height: 16, color: "white" }} strokeWidth={3} />}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#16213D" }}>내용을 확인했습니다</span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => agreed && onComplete(ONBOARDING_DONE_VALUE)}
        disabled={!agreed}
        style={{ width: "100%", minHeight: 48, background: agreed ? "#122A5C" : "#CBD1DC", color: "white", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, cursor: agreed ? "pointer" : "default" }}
      >
        계속하기
      </button>
    </div>
  );
}

// 04_APP_PRD_V9.md S03 "촬영 전 준비"
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

const CHECKLIST = [
  "손 전체가 화면에 보이도록 준비해주세요",
  "밝고 고른 조명이 있는 곳인지 확인해주세요",
  "카메라와 손의 거리를 적당히 맞춰주세요",
  "다음에도 같은 배경·자세로 촬영할 수 있는 곳이면 좋아요",
];

export default function CapturePrepScreen({ onSubmit, onCancel }) {
  const [handSide, setHandSide] = useState(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 44 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginBottom: 6 }}>촬영 전 준비</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", lineHeight: 1.4 }}>어느 손을 기록할까요?</div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {[{ v: "left", l: "왼손" }, { v: "right", l: "오른손" }].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setHandSide(opt.v)}
            style={{
              flex: 1, minHeight: 52, borderRadius: 14, fontSize: 15, fontWeight: 800,
              border: handSide === opt.v ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
              background: handSide === opt.v ? "#eff6ff" : "white",
              color: handSide === opt.v ? "#1d4ed8" : "#334155",
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28, background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>촬영 준비 체크</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CHECKLIST.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Check style={{ width: 15, height: 15, color: "#1d4ed8", marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: 14 }}>
        <p style={{ fontSize: 12, color: "#1d4ed8", lineHeight: 1.6, margin: 0 }}>
          이 촬영은 진단을 위한 검사가 아니라, 다음 기록과 비교하기 위한 기준을 만드는 과정입니다.
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => handSide && onSubmit({ handSide })}
        disabled={!handSide}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: handSide ? "#1d4ed8" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        촬영 시작하기
      </button>
    </div>
  );
}

// RC1.2.1 §2 — 재확인은 기준선과 "같은 손"으로 기록해야 비교가 성립한다.
// 손을 다시 고르게 하지 않고, 기준선에서 쓴 손을 보여주고 확인만 받는다.
import { ArrowLeft, Check } from "lucide-react";

const HAND_LABEL = { left: "왼손", right: "오른손" };

const CHECKLIST = [
  "기준선과 같은 손으로 기록해주세요",
  "밝고 고른 조명이 있는 곳인지 확인해주세요",
  "카메라와 손의 거리를 기준선 때와 비슷하게 맞춰주세요",
];

export default function RecheckHandConfirmScreen({ handSide, dueType, onSubmit, onCancel }) {
  const label = HAND_LABEL[handSide] ?? null;
  const weekLabel = dueType === "week4" ? "4주" : "2주";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F6FA", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 48 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#1F9E96", fontWeight: 700, marginBottom: 6 }}>{weekLabel} 재확인</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#16213D", lineHeight: 1.4, margin: 0, letterSpacing: "-0.02em" }}>
          오늘, 기준선과 같은 조건으로 다시 기록할 시간입니다.
        </h1>
        <p style={{ fontSize: 14, color: "#5B6478", marginTop: 10, lineHeight: 1.6 }}>
          같은 각도·거리·조명일수록 비교가 정확해집니다.
        </p>
      </div>

      <div style={{ background: "white", border: "1px solid #E1E7EF", borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 12, color: "#5B6478", fontWeight: 700 }}>기준선에서 사용한 손</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#16213D", marginTop: 6 }}>
          {label ?? "기록 없음"}
        </div>
        {!label && (
          <p style={{ fontSize: 12, color: "#8A5A20", marginTop: 8, lineHeight: 1.5 }}>
            기준선의 사용 손 정보가 없어 비교 정확도가 낮을 수 있어요.
          </p>
        )}
      </div>

      <div style={{ marginTop: 16, background: "white", border: "1px solid #E1E7EF", borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#16213D", marginBottom: 12 }}>기록 전 확인</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CHECKLIST.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Check style={{ width: 15, height: 15, color: "#1F9E96", marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onSubmit}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: "#122A5C", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        재확인 기록하기
      </button>
    </div>
  );
}

// S13 Outcome — "선택 후 어떻게 느꼈나요?" / "계속할 계획인가요?"
// 자동으로 호전·악화를 판정하지 않는다 — 사용자가 스스로 보고하는 값만 저장한다.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PERCEIVED_OUTCOME, PERCEIVED_OUTCOME_LABEL, CONTINUED_ACTION, CONTINUED_ACTION_LABEL } from "../../lib/v9EventTypes";

export default function OutcomeScreen({ decisionLabel, onSubmit, onCancel }) {
  const [perceivedChange, setPerceivedChange] = useState(null);
  const [continuedAction, setContinuedAction] = useState(null);
  const [note, setNote] = useState("");

  const canSubmit = perceivedChange && continuedAction;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F6FA", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 48 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#122A5C", fontWeight: 700, marginBottom: 6 }}>결과 기록</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#16213D", lineHeight: 1.4 }}>
          {decisionLabel ? `"${decisionLabel}"을(를) 선택한 후,` : "선택 후,"}<br />어떻게 느꼈나요?
        </div>
        <div style={{ fontSize: 13, color: "#5B6478", marginTop: 8, lineHeight: 1.6 }}>
          이 기록은 선택과 결과의 시간적 맥락을 남기며, 인과관계를 확정하지 않습니다.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        {Object.values(PERCEIVED_OUTCOME).map((v) => (
          <button
            key={v}
            onClick={() => setPerceivedChange(v)}
            style={{
              minHeight: 48, borderRadius: 12, fontSize: 15, fontWeight: 800,
              border: perceivedChange === v ? "2px solid #122A5C" : "1px solid #E1E7EF",
              background: perceivedChange === v ? "#EEF1F8" : "#FFFFFF",
              color: perceivedChange === v ? "#122A5C" : "#16213D",
            }}
          >
            {PERCEIVED_OUTCOME_LABEL[v]}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#16213D", marginBottom: 12 }}>계속할 계획인가요?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {Object.values(CONTINUED_ACTION).map((v) => (
          <button
            key={v}
            onClick={() => setContinuedAction(v)}
            style={{
              textAlign: "left", minHeight: 48, padding: "12px 16px", borderRadius: 12, fontSize: 15, fontWeight: 700,
              border: continuedAction === v ? "2px solid #1F9E96" : "1px solid #E1E7EF",
              background: continuedAction === v ? "#EAF6F5" : "#FFFFFF",
              color: continuedAction === v ? "#135F5B" : "#16213D",
            }}
          >
            {CONTINUED_ACTION_LABEL[v]}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#16213D", marginBottom: 8 }}>메모 (선택)</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: "100%", border: "1px solid #E1E7EF", borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => canSubmit && onSubmit({ perceivedChange, continuedAction, note })}
        disabled={!canSubmit}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: canSubmit ? "#122A5C" : "#CBD1DC", color: "white", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800 }}
      >
        저장하기
      </button>
    </div>
  );
}

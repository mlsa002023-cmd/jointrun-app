// S12 Decision Log — "그동안 어떤 관리를 선택했나요?" / "왜 이 선택을 했나요?"
// JOINTRUN이 선택을 추천하거나 정답처럼 표시하지 않는다 — 전부 사용자가 스스로 고르는 목록.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DECISION_TYPE, DECISION_TYPE_LABEL, DECISION_REASON, DECISION_REASON_LABEL } from "../../lib/v9EventTypes";

export default function DecisionLogScreen({ onSubmit, onCancel }) {
  const [decisionType, setDecisionType] = useState(null);
  const [reason, setReason] = useState(null);
  const [memo, setMemo] = useState("");

  const canSubmit = decisionType && reason;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F6FA", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#5B6478", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 48 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#122A5C", fontWeight: 700, marginBottom: 6 }}>Decision Log</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#16213D", lineHeight: 1.4 }}>그동안 어떤 관리를 선택했나요?</div>
        <div style={{ fontSize: 13, color: "#5B6478", marginTop: 8, lineHeight: 1.6 }}>
          JOINTRUN이 치료법을 추천하는 화면이 아니라, 선택한 것과 그 이유를 기록하는 화면입니다.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {Object.values(DECISION_TYPE).map((v) => (
          <button
            key={v}
            onClick={() => setDecisionType(v)}
            style={{
              textAlign: "left", minHeight: 48, padding: "12px 16px", borderRadius: 12, fontSize: 17, fontWeight: 700,
              border: decisionType === v ? "2px solid #122A5C" : "1px solid #E1E7EF",
              background: decisionType === v ? "#EEF1F8" : "#FFFFFF",
              color: decisionType === v ? "#122A5C" : "#16213D",
            }}
          >
            {DECISION_TYPE_LABEL[v]}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#16213D", marginBottom: 12 }}>왜 이 선택을 했나요?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {Object.values(DECISION_REASON).map((v) => (
          <button
            key={v}
            onClick={() => setReason(v)}
            style={{
              textAlign: "left", minHeight: 48, padding: "12px 16px", borderRadius: 12, fontSize: 15, fontWeight: 700,
              border: reason === v ? "2px solid #1F9E96" : "1px solid #E1E7EF",
              background: reason === v ? "#EAF6F5" : "#FFFFFF",
              color: reason === v ? "#135F5B" : "#16213D",
            }}
          >
            {DECISION_REASON_LABEL[v]}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#16213D", marginBottom: 8 }}>메모 (선택)</div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          placeholder="예: 손목보호대를 새로 구입해서 착용하기 시작했어요."
          style={{ width: "100%", border: "1px solid #E1E7EF", borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => canSubmit && onSubmit({ decisionType, decisionLabel: DECISION_TYPE_LABEL[decisionType], reason, memo, startedAt: new Date().toISOString() })}
        disabled={!canSubmit}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: canSubmit ? "#122A5C" : "#CBD1DC", color: "white", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800 }}
      >
        저장하기
      </button>
    </div>
  );
}

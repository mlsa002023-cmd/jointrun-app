import { useState } from "react";
import { X } from "lucide-react";
import { EVENT_TYPES, CUSTOM_EVENT_TYPE } from "../lib/eventTypes";
import { saveEvent } from "../lib/firestore";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 기록 추가 — 타입 칩을 누르면 그 즉시 저장된다(2탭: 진입점 탭 + 타입 탭).
// custom만 예외적으로 라벨 입력 후 별도 저장 버튼을 탭한다.
function EventMarkerModal({ uid, onClose, onSaved, triggerFeedback }) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [timestamp, setTimestamp] = useState(() => toLocalInputValue(new Date()));
  const [saving, setSaving] = useState(false);

  const commitSave = async (type, label) => {
    if (saving) return;
    setSaving(true);
    const record = { type, label, memo, timestamp: new Date(timestamp) };
    const id = await saveEvent(uid, record);
    setSaving(false);
    triggerFeedback?.(`${label} 기록 완료!`);
    onSaved?.({ id, ...record });
    onClose();
  };

  const handleTypeClick = (type) => {
    if (type === CUSTOM_EVENT_TYPE) { setShowCustomInput(true); return; }
    const t = EVENT_TYPES.find((t) => t.value === type);
    commitSave(type, t.label);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>기록 추가</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", minHeight: 44, minWidth: 44 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>날짜/시간</label>
          <input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)}
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 11, boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>메모 (선택)</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택 입력"
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 11, boxSizing: "border-box" }} />
        </div>

        {!showCustomInput ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {EVENT_TYPES.map((t) => (
              <button key={t.value} onClick={() => handleTypeClick(t.value)} disabled={saving}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 8px", fontSize: 11, fontWeight: 700, color: "#334155", cursor: "pointer", minHeight: 44 }}>
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => setShowCustomInput(false)} style={{ alignSelf: "flex-start", fontSize: 10, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              ← 목록으로
            </button>
            <input autoFocus value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="예: 스트레칭 시작"
              style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 12, boxSizing: "border-box" }} />
            <button onClick={() => commitSave(CUSTOM_EVENT_TYPE, customLabel.trim())} disabled={!customLabel.trim() || saving}
              style={{ width: "100%", background: "#2563eb", color: "white", fontWeight: 900, fontSize: 12, padding: 12, borderRadius: 12, border: "none", cursor: "pointer", opacity: !customLabel.trim() || saving ? 0.5 : 1, minHeight: 44 }}>
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventMarkerModal;

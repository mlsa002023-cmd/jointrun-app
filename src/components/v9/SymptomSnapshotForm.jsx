// 04_APP_PRD_V9.md S05 "증상·상황 기록" — 05_DATA_ANALYTICS_SPEC.md SymptomSnapshot 엔터티.
// 모든 값은 사용자 체감 입력이다(카메라가 판정하지 않는다) — 이 화면 어디에도 진단성 표현을 쓰지 않는다.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

function ScaleRow({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(11,1fr)", gap: 4 }}>
        {Array.from({ length: 11 }, (_, n) => n).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              minHeight: 48, borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: value === n ? "2px solid #122A5C" : "1px solid #e2e8f0",
              background: value === n ? "#122A5C" : "white",
              color: value === n ? "white" : "#64748b",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
        <span>없음</span><span>심함</span>
      </div>
    </div>
  );
}

function SegmentRow({ label, options, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              minHeight: 48, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: value === opt.value ? "2px solid #122A5C" : "1px solid #e2e8f0",
              background: value === opt.value ? "#EEF1F8" : "white",
              color: value === opt.value ? "#122A5C" : "#64748b",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SymptomSnapshotForm({ onSubmit, onCancel, simulateError = false }) {
  const [painSelfReport, setPain] = useState(null);
  const [stiffnessSelfReport, setStiffness] = useState(null);
  const [swellingSelfReport, setSwelling] = useState(null);
  const [warmthSelfReport, setWarmth] = useState(null);
  const [functionDifficulty, setFunctionDifficulty] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isValid = painSelfReport != null && stiffnessSelfReport != null && swellingSelfReport && warmthSelfReport && functionDifficulty;
  const canSubmit = isValid && !submitting;

  // 저장은 반드시 성공을 확인하고 넘어간다 — 실패하면 화면을 넘기지 않고 오류 배너를 띄운다.
  // (부모 onSubmit이 성공 시 화면을 닫으므로, 성공 경로에서는 이 컴포넌트가 언마운트된다.)
  // simulateError는 QA 검수에서 실제 네트워크를 끊지 않고 실패 흐름을 확인하기 위한 prop이다.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (simulateError) throw new Error("QA_SIMULATED_NETWORK_ERROR — 저장 직전 강제 실패(디버그)");
      await onSubmit({ painSelfReport, stiffnessSelfReport, swellingSelfReport, warmthSelfReport, functionDifficulty, note: note.trim() || null, recordedAt: new Date().toISOString() });
      // 성공하면 대개 상위가 이 화면을 닫는다(언마운트). 상위가 자체적으로 오류를 처리하고
      // 화면을 유지하는 경우(예: DecisionLoopFlow)엔 버튼이 "저장 중"에 갇히지 않도록 되돌린다.
      setSubmitting(false);
    } catch (e) {
      console.error("[SymptomSnapshotForm] 저장 실패:", e?.name, e?.code || "");
      setError("저장하지 못했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.");
      setSubmitting(false); // 실패 시 다시 시도할 수 있게 활성화(같은 상태라 재시도해도 중복 없음)
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 14, fontWeight: 700, padding: "10px 4px", alignSelf: "flex-start", minHeight: 48 }}>
        <ArrowLeft style={{ width: 18, height: 18 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#122A5C", fontWeight: 700, marginBottom: 6 }}>증상·상황 기록</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", lineHeight: 1.4 }}>지금 느껴지는 상태를 남겨주세요</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>모두 사용자가 느낀 정도를 직접 기록하는 값입니다.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <ScaleRow label="통증 체감 (0~10)" value={painSelfReport} onChange={setPain} />
        <ScaleRow label="뻣뻣함 체감 (0~10)" value={stiffnessSelfReport} onChange={setStiffness} />
        <SegmentRow
          label="붓기 체감"
          value={swellingSelfReport}
          onChange={setSwelling}
          options={[{ value: "none", label: "없음" }, { value: "mild", label: "조금" }, { value: "high", label: "많음" }, { value: "unknown", label: "모르겠음" }]}
        />
        <SegmentRow
          label="열감 체감"
          value={warmthSelfReport}
          onChange={setWarmth}
          options={[{ value: "none", label: "없음" }, { value: "present", label: "있음" }, { value: "unknown", label: "모르겠음" }]}
        />
        <SegmentRow
          label="손 사용 불편"
          value={functionDifficulty}
          onChange={setFunctionDifficulty}
          options={[{ value: "none", label: "없음" }, { value: "mild", label: "가벼움" }, { value: "moderate", label: "보통" }, { value: "high", label: "큼" }]}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>오늘의 상황 메모 (선택)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="예: 아침에 병뚜껑을 열 때 평소보다 불편했어요."
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: "12px 14px", background: "#FDF1EE", border: "1px solid #F3C7BB", borderRadius: 12, fontSize: 13, color: "#B3462E", fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{ marginTop: error ? 12 : 28, width: "100%", minHeight: 48, background: canSubmit ? "#122A5C" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        {submitting ? "저장 중..." : "저장하기"}
      </button>
    </div>
  );
}

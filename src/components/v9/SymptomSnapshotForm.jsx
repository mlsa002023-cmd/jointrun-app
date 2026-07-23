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
              minHeight: 32, borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: value === n ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
              background: value === n ? "#1d4ed8" : "white",
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
              minHeight: 40, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: value === opt.value ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
              background: value === opt.value ? "#eff6ff" : "white",
              color: value === opt.value ? "#1d4ed8" : "#64748b",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SymptomSnapshotForm({ onSubmit, onCancel }) {
  const [painSelfReport, setPain] = useState(null);
  const [stiffnessSelfReport, setStiffness] = useState(null);
  const [swellingSelfReport, setSwelling] = useState(null);
  const [warmthSelfReport, setWarmth] = useState(null);
  const [functionDifficulty, setFunctionDifficulty] = useState(null);
  const [note, setNote] = useState("");

  const canSubmit = painSelfReport != null && stiffnessSelfReport != null && swellingSelfReport && warmthSelfReport && functionDifficulty;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 44 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, marginBottom: 6 }}>증상·상황 기록</div>
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

      <button
        onClick={() => canSubmit && onSubmit({ painSelfReport, stiffnessSelfReport, swellingSelfReport, warmthSelfReport, functionDifficulty, note: note.trim() || null, recordedAt: new Date().toISOString() })}
        disabled={!canSubmit}
        style={{ marginTop: 28, width: "100%", minHeight: 48, background: canSubmit ? "#1d4ed8" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        저장하기
      </button>
    </div>
  );
}

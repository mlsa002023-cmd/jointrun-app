// 04_APP_PRD_V9.md S09 "과거의 나와 비교"
// 이미지 원본을 저장하지 않으므로(개인정보 최소수집), 기준선/현재를 나란히 보여주는 기준은
// 사용자 체감 증상값이다 — 자동으로 좋아짐/나빠짐을 판정하지 않고 사용자가 직접 표시하게 한다.
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { evaluateComparability } from "../../lib/captureQuality";

const SYMPTOM_ROWS = [
  { key: "painSelfReport", label: "통증 체감" },
  { key: "stiffnessSelfReport", label: "뻣뻣함 체감" },
  { key: "swellingSelfReport", label: "붓기 체감" },
  { key: "warmthSelfReport", label: "열감 체감" },
  { key: "functionDifficulty", label: "손 사용 불편" },
];

const CHANGE_OPTIONS = [
  { value: "less_discomfort", label: "덜함" },
  { value: "same", label: "비슷함" },
  { value: "more_discomfort", label: "더함" },
  { value: "unclear", label: "판단 어려움" },
];

const NON_COMPARABLE_LABEL = {
  hand_side_mismatch: "촬영한 손이 서로 달라요",
  current_quality_unreliable: "이번 촬영 조건이 비교하기에 불안정했어요",
  baseline_quality_unreliable: "기준선 촬영 조건이 비교하기에 불안정했어요",
  missing_capture: "비교할 기록을 찾을 수 없어요",
};

function fmtDate(date) {
  if (!date) return "-";
  const d = date?.toDate ? date.toDate() : date;
  return new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
const HAND_LABEL = { left: "왼손", right: "오른손" };

const SYMPTOM_VALUE_LABEL = {
  swellingSelfReport: { none: "없음", mild: "조금", high: "많음", unknown: "모르겠음" },
  warmthSelfReport: { none: "없음", present: "있음", unknown: "모르겠음" },
  functionDifficulty: { none: "없음", mild: "가벼움", moderate: "보통", high: "큼" },
};

function formatSymptomValue(key, value) {
  if (value == null) return "—";
  const map = SYMPTOM_VALUE_LABEL[key];
  return map ? (map[value] ?? value) : value;
}

export default function ComparisonScreen({ baselineCapture, currentCapture, onSubmit, onCancel, onViewed }) {
  const [change, setChange] = useState(null);
  const { comparable, reasons } = evaluateComparability(baselineCapture, currentCapture);

  useEffect(() => { onViewed?.({ comparable }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "24px 20px 32px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 700, padding: "6px 0", alignSelf: "flex-start", minHeight: 44 }}>
        <ArrowLeft style={{ width: 15, height: 15 }} />뒤로
      </button>

      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#122A5C", fontWeight: 700, marginBottom: 6 }}>과거의 나와 비교</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", lineHeight: 1.4 }}>
          JOINTRUN은 관찰된 기록을 나란히 보여줍니다.
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
          질환의 악화나 치료 효과를 판정하지 않습니다.
        </div>
      </div>

      {!comparable && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#92400e", margin: 0 }}>
            촬영 조건 차이가 커 직접 비교가 어렵습니다. 기록은 보관되며 다음 촬영에서 다시 확인할 수 있습니다.
          </p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {reasons.map((r) => (
              <li key={r} style={{ fontSize: 11, color: "#a16207" }}>{NON_COMPARABLE_LABEL[r] ?? r}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11, fontWeight: 800, color: "#94a3b8", marginBottom: 10 }}>
          <span>항목</span><span style={{ textAlign: "center" }}>기준선</span><span style={{ textAlign: "center" }}>지금</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>촬영 날짜</span>
          <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 700 }}>{fmtDate(baselineCapture?.capturedAt)}</span>
          <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 700 }}>{fmtDate(currentCapture?.capturedAt)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>사용 손</span>
          <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 700 }}>{HAND_LABEL[baselineCapture?.handSide] ?? "-"}</span>
          <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 700 }}>{HAND_LABEL[currentCapture?.handSide] ?? "-"}</span>
        </div>
        {SYMPTOM_ROWS.map((row) => (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>{row.label}</span>
            <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>
              {formatSymptomValue(row.key, baselineCapture?.symptomSnapshot?.[row.key])}
            </span>
            <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>
              {formatSymptomValue(row.key, currentCapture?.symptomSnapshot?.[row.key])}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>기준선 때보다 지금은 어떤가요?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {CHANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setChange(opt.value)}
              style={{
                minHeight: 48, borderRadius: 12, fontSize: 13, fontWeight: 800,
                border: change === opt.value ? "2px solid #122A5C" : "1px solid #e2e8f0",
                background: change === opt.value ? "#EEF1F8" : "white",
                color: change === opt.value ? "#122A5C" : "#334155",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => change && onSubmit({ comparable, nonComparableReasons: reasons, userPerceivedChange: change })}
        disabled={!change}
        style={{ marginTop: 24, width: "100%", minHeight: 48, background: change ? "#122A5C" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800 }}
      >
        저장하기
      </button>
    </div>
  );
}

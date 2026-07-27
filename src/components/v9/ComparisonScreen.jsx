// 04_APP_PRD_V9.md S09 "과거의 나와 비교"
// 이미지 원본을 저장하지 않으므로(개인정보 최소수집), 기준선/현재를 나란히 보여주는 기준은
// 사용자 체감 증상값이다 — 자동으로 좋아짐/나빠짐을 판정하지 않고 사용자가 직접 표시하게 한다.
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { evaluateComparability } from "../../lib/captureQuality";
import {
  toObservationView, pairFingerObservations, hasGenerationMismatch, hasPoseProtocolMismatch, OBSERVATION_GENERATION,
} from "../../lib/captureObservationAdapter";
import ObservationComparisonTable from "./ObservationComparisonTable";
import ObservationSummaryCard from "./ObservationSummaryCard";
import { buildObservationSummary, SUMMARY_MODE } from "../../lib/observationSummary";

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
  // RC1.2.2 P0-10 — 한쪽만 관절별 관찰을 가진 경우. 구형 기록을 신형 수치로 추정하지 않는다.
  algorithm_version_mismatch: "기준선과 현재 기록의 측정 방식이 달라 관절별 수치를 직접 비교하지 않습니다.",
  // P0-14 §12 — 포즈 프로토콜(측정 방식) 불일치. 구형 기준선 ↔ 신규 재확인.
  pose_protocol_mismatch: "기준선과 현재 기록의 측정 방식이 달라 관절별 수치를 직접 비교하지 않습니다.",
};

function fmtDate(date) {
  if (!date) return "-";
  const d = date?.toDate ? date.toDate() : date;
  return new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
const HAND_LABEL = { left: "왼손", right: "오른손" };

// RC1.2.1 §2 — 관찰 각도 표기. 값이 없으면 "—"(재확인 전 기록에는 각도가 없을 수 있다).
function fmtRom(v) {
  return v == null ? "—" : `${Math.round(v)}°`;
}

// RC1.2.2 P0-10 — 구형 평균 ROM/손가락 각도는 legacy 기록에서만 보조로 보여준다.
// 신규 세대에서는 관절별(DIP/PIP) 관찰이 주 비교 대상이다.
function legacyFingerRows(baselineView, currentView) {
  const b = baselineView?.fingers ?? [];
  const c = currentView?.fingers ?? [];
  const keys = [...new Set([...b.map((f) => f.key), ...c.map((f) => f.key)])];
  return keys.map((key) => ({
    key,
    name: b.find((f) => f.key === key)?.name ?? c.find((f) => f.key === key)?.name ?? key,
    baseline: b.find((f) => f.key === key)?.legacyRomDeg ?? null,
    current: c.find((f) => f.key === key)?.legacyRomDeg ?? null,
  }));
}

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

export default function ComparisonScreen({ baselineCapture, currentCapture, onSubmit, onCancel, onViewed, personalRepeatBand = null }) {
  const [change, setChange] = useState(null);
  const { comparable, reasons, comparisonQualityUnverified } = evaluateComparability(baselineCapture, currentCapture);

  // RC1.2.2 P0-10 — capture 문서를 세대에 맞게 정규화한다. 신규 필드가 있으면 그것이
  // source of truth이고, 구형 필드는 legacy 기록에서만 보조로 쓴다(누락은 0이 아니라 —).
  const baselineView = toObservationView(baselineCapture);
  const currentView = toObservationView(currentCapture);
  const pairs = pairFingerObservations(baselineView, currentView);
  const generationMismatch = hasGenerationMismatch(baselineView, currentView);
  // P0-14 §12 — 세대(관절 관찰 유무) 또는 포즈 프로토콜이 다르면 직접 비교하지 않는다.
  const protocolMismatch = generationMismatch || hasPoseProtocolMismatch(baselineView, currentView);
  const bothLegacy =
    baselineView?.generation === OBSERVATION_GENERATION.LEGACY_ROM &&
    currentView?.generation === OBSERVATION_GENERATION.LEGACY_ROM;

  // RC1.2.2 P0-12 — 상세 표 위에 규칙 기반 한줄 요약을 먼저 보여준다.
  const summary = buildObservationSummary({
    mode: SUMMARY_MODE.RECHECK,
    baselineCapture,
    currentCapture,
    comparisonQuality: { comparable, reasons },
    personalRepeatBand: personalRepeatBand ?? null,
  });

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

      <ObservationSummaryCard summary={summary} />

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

      {/* RC1.2.1 §3 — 조명·거리·흔들림을 아직 검증하지 않은 기록임을 사실대로 알린다.
          "비교 불가" 경고도, "비교 가능" 확정도 아닌 중립 안내. */}
      {comparable && comparisonQualityUnverified && (
        <div style={{ background: "#F4F6FA", border: "1px solid #E1E7EF", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#5B6478", margin: 0, lineHeight: 1.6 }}>
            조명·거리·흔들림 등 동일 조건 여부는 아직 검증하지 않았습니다. 아래 값은 각 시점에 관찰된 기록입니다.
          </p>
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
        {/* RC1.2.2 P0-10 — 구형 평균 ROM/손가락 각도는 양쪽 모두 구형 기록일 때만 보조로 남긴다.
            신규 세대에서는 아래 관절별(DIP/PIP) 관찰이 주 비교 대상이다. */}
        {bothLegacy && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>평균 ROM</span>
              <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>{fmtRom(baselineView?.legacyAverageRomDeg)}</span>
              <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>{fmtRom(currentView?.legacyAverageRomDeg)}</span>
            </div>
            {legacyFingerRows(baselineView, currentView).map((row) => (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>{row.name} 각도</span>
                <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>{fmtRom(row.baseline)}</span>
                <span style={{ fontSize: 13, color: "#0f172a", textAlign: "center", fontWeight: 800 }}>{fmtRom(row.current)}</span>
              </div>
            ))}
          </>
        )}
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

      {/* 관절별 관찰 비교 — 신규 세대의 주 비교 화면 */}
      {!bothLegacy && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#122A5C", marginBottom: 4 }}>손가락별 관절 관찰</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, lineHeight: 1.6 }}>
            {protocolMismatch
              ? "기준선과 현재 기록의 측정 방식이 달라 관절별 수치를 직접 비교하지 않습니다. 현재 값만 표시하고 기준선은 이전 방식 기록으로 둡니다."
              : "각 시점에 관찰된 값을 나란히 놓았습니다. 좋아짐·나빠짐을 자동으로 판정하지 않습니다."}
          </div>
          <ObservationComparisonTable pairs={pairs} baselineView={baselineView} currentView={currentView} focusKeys={summary?.focusFingerKeys ?? []} baselineAsLegacy={protocolMismatch} />
          <div style={{ marginTop: 12, fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>
            외곽 폭은 인접 마디 대비 비율입니다. 이 값은 질환이나 붓기의 원인을 판정하지 않습니다.
          </div>
        </div>
      )}

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

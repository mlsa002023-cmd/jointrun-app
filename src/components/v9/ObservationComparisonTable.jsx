// RC1.2.2 P0-10 — 기준선/지금 관찰값을 손가락별로 나란히 보여준다.
//
// 표시 규칙(§3):
//   - 실제 0은 "0°"로 적는다. 값 누락은 "—". 둘을 절대 섞지 않는다.
//   - 구형 기록이라 신규 항목이 아예 없으면 "이전 방식 기록".
//   - null/undefined를 0으로 바꾸지 않는다.
//   - 방향은 엄지쪽 / 새끼쪽 / 치우침 없음.
//
// 자동으로 좋아짐·나빠짐을 판정하지 않는다 — 두 값을 나란히 놓기만 한다.
import { OBSERVATION_GENERATION } from "../../lib/captureObservationAdapter";

const DIRECTION_LABEL = { radial: "엄지쪽", ulnar: "새끼쪽", neutral: "치우침 없음" };

const LEGACY_PLACEHOLDER = "이전 방식 기록";
const MISSING = "—";

/** 각도 표기. 0은 값이므로 "0°", 없으면 "—". */
export function fmtDeg(v) {
  return Number.isFinite(v) ? `${Math.round(v)}°` : MISSING;
}

/** 비율 표기(외곽 폭 등). 0도 값으로 취급한다. */
export function fmtRatio(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : MISSING;
}

/** 부호 있는 편위각 → "크기 + 방향". 부호를 그대로 노출하지 않는다. */
export function fmtDeviation(deg, direction) {
  if (!Number.isFinite(deg)) return MISSING;
  const label = DIRECTION_LABEL[direction] ?? "";
  if (direction === "neutral") return `${Math.abs(Math.round(deg))}° 치우침 없음`;
  return `${Math.abs(Math.round(deg))}°${label ? ` ${label}` : ""}`;
}

/**
 * 한쪽 capture의 값을 화면 문자열로 만든다.
 * 그 세대에 항목 자체가 없으면(구형 기록) "이전 방식 기록"으로 구분한다 — "—"(관찰 실패)와 다르다.
 */
function cellText(view, finger, render) {
  if (!view) return MISSING;
  if (view.generation === OBSERVATION_GENERATION.LEGACY_ROM) return LEGACY_PLACEHOLDER;
  if (!finger) return MISSING;
  return render(finger);
}

const cellStyle = (text) => ({
  fontSize: text === LEGACY_PLACEHOLDER ? 10 : 12,
  color: text === LEGACY_PLACEHOLDER ? "#94a3b8" : "#0f172a",
  textAlign: "center",
  fontWeight: text === LEGACY_PLACEHOLDER ? 700 : 800,
});

function Row({ label, baselineText, currentText }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 8, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{label}</span>
      <span style={cellStyle(baselineText)}>{baselineText}</span>
      <span style={cellStyle(currentText)}>{currentText}</span>
    </div>
  );
}

/** 손가락 한 개의 DIP·PIP·외곽 관찰을 기준선/지금 두 열로 보여준다. */
function FingerBlock({ pair, baselineView, currentView }) {
  const rows = [
    {
      label: "끝마디 편 상태 굽힘",
      render: (f) => fmtDeg(f.dipExtensionPoseFlexionDeg),
    },
    {
      label: "끝마디 좌우 치우침",
      render: (f) => fmtDeviation(f.dipExtensionPoseDeviationDeg, f.dipDeviationDirection),
    },
    {
      label: "끝마디 활동 범위",
      render: (f) => fmtDeg(f.dipActiveRomDeg),
    },
    {
      label: "끝마디 외곽 폭",
      render: (f) => fmtRatio(f.contour?.dipWidthRatio),
    },
    {
      label: "좌우 윤곽 비대칭",
      render: (f) => fmtRatio(f.contour?.contourAsymmetryRatio),
    },
    {
      label: "중간마디 편 상태 굽힘",
      render: (f) => fmtDeg(f.pipExtensionPoseFlexionDeg),
    },
    {
      label: "중간마디 좌우 치우침",
      render: (f) => fmtDeviation(f.pipExtensionPoseDeviationDeg, f.pipDeviationDirection),
    },
    {
      label: "중간마디 활동 범위",
      render: (f) => fmtDeg(f.pipActiveRomDeg),
    },
  ];

  return (
    <div style={{ marginTop: 14 }} data-testid={`compare-finger-${pair.key}`}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#122A5C", marginBottom: 2 }}>{pair.name}</div>
      {rows.map((r) => (
        <Row
          key={r.label}
          label={r.label}
          baselineText={cellText(baselineView, pair.baseline, r.render)}
          currentText={cellText(currentView, pair.current, r.render)}
        />
      ))}
    </div>
  );
}

export default function ObservationComparisonTable({ pairs, baselineView, currentView }) {
  if (!pairs?.length) {
    return (
      <div style={{ fontSize: 12, color: "#64748b", padding: "10px 0" }}>
        비교할 손가락 관찰 기록이 없습니다.
      </div>
    );
  }

  return (
    <div data-testid="observation-comparison">
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 8, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>
        <span>관찰 항목</span>
        <span style={{ textAlign: "center" }}>기준선</span>
        <span style={{ textAlign: "center" }}>지금</span>
      </div>
      {pairs.map((pair) => (
        <FingerBlock key={pair.key} pair={pair} baselineView={baselineView} currentView={currentView} />
      ))}
    </div>
  );
}

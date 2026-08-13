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

import { fmtDeg, fmtPercent, fmtDeviation, fmtAsymmetry, MISSING } from "../../lib/observationFormat";

const LEGACY_PLACEHOLDER = "이전 방식 기록";

/**
 * 한쪽 capture의 값을 화면 문자열로 만든다.
 * 그 세대에 항목 자체가 없으면(구형 기록) "이전 방식 기록"으로 구분한다 — "—"(관찰 실패)와 다르다.
 */
function cellText(view, finger, render, forceLegacy = false) {
  if (!view) return MISSING;
  // P0-14 §12 — 포즈 프로토콜이 다르면 기준선 쪽은 "이전 방식 기록"으로 표시한다(직접 비교 금지).
  if (forceLegacy) return LEGACY_PLACEHOLDER;
  if (view.generation === OBSERVATION_GENERATION.LEGACY_ROM) return LEGACY_PLACEHOLDER;
  if (!finger) return MISSING;
  return render(finger);
}

/** 측면 비대칭은 방향 없는 크기(%)만 표시한다(§6 — 해부학적 방향 확신 없음). */
function sideAsymText(ratio) {
  return Number.isFinite(ratio) ? `${Math.round(ratio * 100)}% 비대칭` : MISSING;
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
function FingerBlock({ pair, baselineView, currentView, baselineAsLegacy = false }) {
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
      label: "정면 외곽 폭(인접 마디 대비)",
      render: (f) => fmtPercent(f.contour?.dipWidthRatio),
    },
    {
      label: "정면 좌우 윤곽 비대칭",
      render: (f) => fmtAsymmetry(f.contour?.contourAsymmetryRatio),
    },
    // P0-14 — 측면 외곽 프로파일(관찰된 경우만 값, 아니면 —).
    {
      label: "측면 외곽 프로파일",
      render: (f) => fmtPercent(f.sideContour?.dipSideProfileRatio),
    },
    {
      label: "측면 좌우 비대칭",
      render: (f) => sideAsymText(f.sideContour?.sideProfileAsymmetryRatio),
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
          baselineText={cellText(baselineView, pair.baseline, r.render, baselineAsLegacy)}
          currentText={cellText(currentView, pair.current, r.render)}
        />
      ))}
    </div>
  );
}

/**
 * RC1.2.2 P0-12.1 §5 — 기본은 주요 관찰 손가락만 보여주고, 나머지는 접어 둔다.
 * @param {string[]} focusKeys 요약이 지목한 손가락(최대 2개). 없으면 앞의 2개를 쓴다.
 */
export default function ObservationComparisonTable({ pairs, baselineView, currentView, focusKeys = [], baselineAsLegacy = false }) {
  if (!pairs?.length) {
    return (
      <div style={{ fontSize: 12, color: "#64748b", padding: "10px 0" }}>
        비교할 손가락 관찰 기록이 없습니다.
      </div>
    );
  }

  const focus = focusKeys.length
    ? pairs.filter((p) => focusKeys.includes(p.key)).slice(0, 2)
    : pairs.slice(0, 2);
  const focusSet = new Set(focus.map((p) => p.key));
  const rest = pairs.filter((p) => !focusSet.has(p.key));

  const Header = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 8, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>
      <span>관찰 항목</span>
      <span style={{ textAlign: "center" }}>기준선</span>
      <span style={{ textAlign: "center" }}>지금</span>
    </div>
  );

  return (
    <div data-testid="observation-comparison">
      <Header />
      {focus.map((pair) => (
        <FingerBlock key={pair.key} pair={pair} baselineView={baselineView} currentView={currentView} baselineAsLegacy={baselineAsLegacy} />
      ))}

      {rest.length > 0 && (
        <details style={{ marginTop: 12 }} data-testid="comparison-details-toggle">
          <summary style={{ fontSize: 12, fontWeight: 800, color: "#122A5C", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
            전체 손가락 상세 펼치기
          </summary>
          <div style={{ marginTop: 4 }}>
            <Header />
            {rest.map((pair) => (
              <FingerBlock key={pair.key} pair={pair} baselineView={baselineView} currentView={currentView} baselineAsLegacy={baselineAsLegacy} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// 통합 — 한줄 요약과 상세 수치가 같은 capture에서 일치하는지 (RC1.2.2 P0-11/P0-12 C)
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonScreen from "./ComparisonScreen";
import ObservationSummaryCard from "./ObservationSummaryCard";
import JointObservationResult from "./JointObservationResult";
import DipContourResult from "./DipContourResult";
import { buildObservationSummary, SUMMARY_MODE } from "../../lib/observationSummary";
import { toObservationView } from "../../lib/captureObservationAdapter";

const joints = [
  { key: "index", name: "검지", dipExtensionPoseFlexionDeg: 4, dipExtensionPoseDeviationDeg: 2, dipDeviationDirection: "radial", dipActiveRomDeg: 30, pipExtensionPoseFlexionDeg: 10, pipExtensionPoseDeviationDeg: 1, pipDeviationDirection: "neutral", pipActiveRomDeg: 60, dipObserved: true, pipObserved: true },
  { key: "middle", name: "중지", dipExtensionPoseFlexionDeg: 6, dipExtensionPoseDeviationDeg: 3, dipDeviationDirection: "radial", dipActiveRomDeg: 28, pipExtensionPoseFlexionDeg: 11, pipExtensionPoseDeviationDeg: 1, pipDeviationDirection: "neutral", pipActiveRomDeg: 58, dipObserved: true, pipObserved: true },
  { key: "ring", name: "약지", dipExtensionPoseFlexionDeg: 26, dipExtensionPoseDeviationDeg: 4, dipDeviationDirection: "radial", dipActiveRomDeg: 12, pipExtensionPoseFlexionDeg: 12, pipExtensionPoseDeviationDeg: 2, pipDeviationDirection: "neutral", pipActiveRomDeg: 55, dipObserved: true, pipObserved: true },
  { key: "pinky", name: "소지", dipExtensionPoseFlexionDeg: 5, dipExtensionPoseDeviationDeg: 19, dipDeviationDirection: "radial", dipActiveRomDeg: 26, pipExtensionPoseFlexionDeg: 10, pipExtensionPoseDeviationDeg: 1, pipDeviationDirection: "neutral", pipActiveRomDeg: 57, dipObserved: true, pipObserved: true },
];

const contourPayload = {
  measurementVersion: "dip-contour-v1",
  fingers: joints.map((j, i) => ({
    key: j.key, name: j.name,
    dipWidthRatio: [0.95, 0.94, 1.03, 1.0][i],
    contourAsymmetryRatio: [0.02, 0.06, 0.0, 0.1][i],
    radialHalfWidthRatio: 0.48, ulnarHalfWidthRatio: 0.46, validFrames: 12, stabilityMad: 0.01,
  })),
};

const capture = (over = {}) => ({
  algorithmVersion: "v1.1",
  handSide: "left",
  capturedAt: new Date("2026-07-26T09:00:00Z"),
  comparisonQualityStatus: "unverified",
  recordingStatus: "completed",
  perFingerJointObservation: joints,
  dipContourObservation: contourPayload,
  averageObservedRomDeg: 0,
  perFingerObservedRomDeg: joints.map((j) => ({ key: j.key, name: j.name, romDeg: 0 })),
  symptomSnapshot: { painSelfReport: 5 },
  ...over,
});

describe("결과 화면 — 요약이 상세값과 일치한다", () => {
  it("요약이 고른 손가락이 상세 카드에 실제로 존재한다", () => {
    const summary = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture() });
    render(
      <div>
        <ObservationSummaryCard summary={summary} />
        <JointObservationResult joints={joints} />
        <DipContourResult contour={contourPayload} />
      </div>
    );
    expect(summary.focusFingerKeys.length).toBeGreaterThan(0);
    summary.focusFingerKeys.forEach((key) => {
      expect(screen.getByTestId(`joint-row-${key}`)).toBeInTheDocument();
    });
  });

  it("요약이 지목한 값이 상세 카드의 값과 같은 근거를 가진다", () => {
    const summary = buildObservationSummary({ mode: SUMMARY_MODE.BASELINE, currentCapture: capture() });
    // 약지는 DIP 잔여 굽힘 26°로 가장 크고, 소지는 편위 19°로 가장 크다.
    expect(summary.headline).toMatch(/약지 끝마디 말림/);
    expect(summary.headline).toMatch(/소지/);
    render(<JointObservationResult joints={joints} />);
    expect(within(screen.getByTestId("joint-row-ring")).getByText("26°")).toBeInTheDocument();
    expect(within(screen.getByTestId("joint-row-pinky")).getByText("19° 엄지쪽")).toBeInTheDocument();
  });

  it("요약과 상세가 같은 adapter를 통해 같은 값을 본다", () => {
    const view = toObservationView(capture());
    const ring = view.fingers.find((f) => f.key === "ring");
    expect(ring.dipExtensionPoseFlexionDeg).toBe(26);
    expect(ring.contour.dipWidthRatio).toBe(1.03);
  });
});

describe("비교 화면 — 요약이 최상단에 있다", () => {
  function renderCompare(baseline, current) {
    return render(
      <ComparisonScreen
        baselineCapture={baseline} currentCapture={current}
        onSubmit={vi.fn()} onCancel={vi.fn()} onViewed={vi.fn()}
      />
    );
  }

  it("요약 카드가 관절별 비교표보다 앞에 나온다", () => {
    const { container } = renderCompare(capture(), capture());
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="observation-summary"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="observation-summary"'))
      .toBeLessThan(html.indexOf('data-testid="observation-comparison"'));
  });

  it("신규 관절값이 비교표에 반영된다", () => {
    renderCompare(capture(), capture());
    const row = screen.getByTestId("compare-finger-ring");
    expect(within(row).getAllByText("26°").length).toBe(2);
  });

  it("구형 기준선이면 요약이 직접 비교하지 않는다고 알린다", () => {
    const legacy = { algorithmVersion: "v1.0", handSide: "left", comparisonQualityStatus: "unverified", averageObservedRomDeg: 0, perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 0 }], symptomSnapshot: {} };
    renderCompare(legacy, capture());
    expect(screen.getByTestId("observation-summary-headline").textContent)
      .toMatch(/이전 측정 방식으로 기록되어|직접 비교하지 않습니다/);
  });

  it("증상 비교는 그대로 유지된다", () => {
    renderCompare(capture(), capture({ symptomSnapshot: { painSelfReport: 2 } }));
    expect(screen.getByText("통증 체감")).toBeInTheDocument();
  });
});

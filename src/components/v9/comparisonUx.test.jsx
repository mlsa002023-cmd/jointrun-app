// P0-12.1 UX 보정 회귀 — 정보 구조·표기 정합성
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import ComparisonScreen from "./ComparisonScreen";

const joint = (key, name, over = {}) => ({
  key, name,
  dipExtensionPoseFlexionDeg: 5, dipExtensionPoseDeviationDeg: -7, dipDeviationDirection: "ulnar",
  dipActiveRomDeg: 30,
  pipExtensionPoseFlexionDeg: 10, pipExtensionPoseDeviationDeg: 2, pipDeviationDirection: "radial",
  pipActiveRomDeg: 60,
  ...over,
});

const FOUR = [
  joint("index", "검지", { dipExtensionPoseFlexionDeg: 22 }),
  joint("middle", "중지"),
  joint("ring", "약지", { dipExtensionPoseFlexionDeg: 20 }),
  joint("pinky", "소지"),
];

const capture = (over = {}) => ({
  algorithmVersion: "v1.1",
  handSide: "left",
  capturedAt: new Date("2026-07-26T09:00:00Z"),
  comparisonQualityStatus: "unverified",
  recordingStatus: "completed",
  perFingerJointObservation: FOUR,
  dipContourObservation: {
    measurementVersion: "dip-contour-v1",
    fingers: FOUR.map((f) => ({ key: f.key, dipWidthRatio: 0.88, contourAsymmetryRatio: -0.07, radialHalfWidthRatio: 0.4, ulnarHalfWidthRatio: 0.48 })),
  },
  symptomSnapshot: { painSelfReport: 5 },
  ...over,
});

function renderCompare(baseline = capture(), current = capture()) {
  return render(
    <ComparisonScreen
      baselineCapture={baseline} currentCapture={current}
      onSubmit={vi.fn()} onCancel={vi.fn()} onViewed={vi.fn()}
    />
  );
}

describe("§5 정보 구조 — 기본은 주요 손가락만", () => {
  it("기본 화면에는 최대 2개 손가락만 펼쳐져 있다", () => {
    const { container } = renderCompare();
    const openRows = container.querySelectorAll('[data-testid^="compare-finger-"]');
    const details = screen.getByTestId("comparison-details-toggle");
    const inDetails = details.querySelectorAll('[data-testid^="compare-finger-"]').length;
    expect(openRows.length - inDetails).toBeLessThanOrEqual(2);
  });

  it("'전체 손가락 상세 펼치기'로 나머지를 볼 수 있다", () => {
    renderCompare();
    const details = screen.getByTestId("comparison-details-toggle");
    expect(within(details).getByText("전체 손가락 상세 펼치기")).toBeInTheDocument();
    fireEvent.click(within(details).getByText("전체 손가락 상세 펼치기"));
    expect(details.querySelectorAll('[data-testid^="compare-finger-"]').length).toBeGreaterThan(0);
  });

  it("증상 비교와 체감 선택은 기본 화면에 그대로 있다", () => {
    renderCompare();
    expect(screen.getByText("통증 체감")).toBeInTheDocument();
    expect(screen.getByText("기준선 때보다 지금은 어떤가요?")).toBeInTheDocument();
  });
});

describe("§3 표기 정합성", () => {
  it("윤곽 비대칭에 음수 부호가 노출되지 않는다", () => {
    const { container } = renderCompare();
    expect(container.textContent).toMatch(/7% 새끼쪽/);
    expect(container.textContent).not.toMatch(/-7%/);
  });

  it("편위각도 부호 없이 방향으로 적는다", () => {
    const { container } = renderCompare();
    expect(container.textContent).toMatch(/7° 새끼쪽/);
    expect(container.textContent).not.toMatch(/-7°/);
  });
});

describe("§4 외곽 폭 라벨", () => {
  it("무엇 대비 비율인지 라벨에 드러낸다", () => {
    renderCompare();
    expect(screen.getAllByText("정면 외곽 폭(인접 마디 대비)").length).toBeGreaterThan(0);
  });
});

describe("§1·§2 요약 정합성", () => {
  it("headline에 각도 숫자를 넣지 않는다", () => {
    renderCompare(capture(), capture({
      perFingerJointObservation: FOUR.map((f) => ({ ...f, dipExtensionPoseFlexionDeg: f.dipExtensionPoseFlexionDeg + 9 })),
    }));
    const headline = screen.getByTestId("observation-summary-headline").textContent;
    expect(headline).not.toMatch(/\d+°/);
  });

  it("unverified 상태에서 '같은 자세'·'동일 조건' 확정 표현을 쓰지 않는다", () => {
    const { container } = renderCompare();
    expect(container.textContent).not.toMatch(/같은 자세로 기록된|동일 조건으로 기록/);
  });
});

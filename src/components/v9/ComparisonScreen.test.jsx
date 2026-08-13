// ComparisonScreen — 신규 관절/외곽 관찰 비교 (RC1.2.2 P0-10)
//
// 핵심 회귀: 신규 capture는 perFingerJointObservation을 저장하는데 비교 화면이 구형 필드만
// 읽어서, 구형 ROM이 0으로 기록된 실기기에서 비교 화면이 전부 0°로 보였다.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ComparisonScreen from "./ComparisonScreen";

const joint = (over = {}) => ({
  key: "index", name: "검지",
  dipExtensionPoseFlexionDeg: 18, dipExtensionPoseDeviationDeg: -7,
  dipDeviationDirection: "ulnar", dipActiveRomDeg: 44,
  pipExtensionPoseFlexionDeg: 12, pipExtensionPoseDeviationDeg: 3,
  pipDeviationDirection: "radial", pipActiveRomDeg: 76,
  ...over,
});

const contour = (over = {}) => ({
  measurementVersion: "dip-contour-v1",
  fingers: [{ key: "index", dipWidthRatio: 0.95, contourAsymmetryRatio: 0.02, radialHalfWidthRatio: 0.48, ulnarHalfWidthRatio: 0.46, ...over }],
});

const newCapture = (over = {}) => ({
  algorithmVersion: "v1.1",
  handSide: "left",
  capturedAt: new Date("2026-07-26T09:00:00Z"),
  comparisonQualityStatus: "unverified",
  perFingerJointObservation: [joint()],
  // 실기기에서 구형 호환 값이 0으로 기록된 상황을 그대로 재현한다.
  averageObservedRomDeg: 0,
  perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 0 }],
  symptomSnapshot: { painSelfReport: 5, stiffnessSelfReport: 4 },
  ...over,
});

const legacyCapture = (over = {}) => ({
  algorithmVersion: "v1.0",
  handSide: "left",
  capturedAt: new Date("2026-07-01T09:00:00Z"),
  comparisonQualityStatus: "unverified",
  averageObservedRomDeg: 0,
  perFingerObservedRomDeg: [{ key: "index", name: "검지", romDeg: 0 }],
  symptomSnapshot: { painSelfReport: 6, stiffnessSelfReport: 6 },
  ...over,
});

function renderScreen(baseline, current) {
  return render(
    <ComparisonScreen
      baselineCapture={baseline}
      currentCapture={current}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      onViewed={vi.fn()}
    />
  );
}

describe("신규 ↔ 신규 비교", () => {
  it("구형 ROM이 0이어도 신규 DIP 값을 렌더링한다(0으로 유실되지 않음)", () => {
    renderScreen(newCapture(), newCapture({
      perFingerJointObservation: [joint({ dipExtensionPoseFlexionDeg: 25, dipActiveRomDeg: 30 })],
    }));
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getByText("18°")).toBeInTheDocument(); // 기준선 DIP 편 상태
    expect(within(row).getByText("25°")).toBeInTheDocument(); // 현재 DIP 편 상태
    expect(within(row).getByText("44°")).toBeInTheDocument(); // 기준선 DIP 활동 범위
  });

  it("DIP 좌우 치우침을 크기와 방향으로 보여준다", () => {
    renderScreen(newCapture(), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getAllByText("7° 새끼쪽").length).toBe(2);
  });

  it("PIP 값도 기준선/지금 두 열로 보여준다", () => {
    renderScreen(newCapture(), newCapture({
      perFingerJointObservation: [joint({ pipActiveRomDeg: 61, pipExtensionPoseFlexionDeg: 9 })],
    }));
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getByText("76°")).toBeInTheDocument();
    expect(within(row).getByText("61°")).toBeInTheDocument();
    expect(within(row).getByText("9°")).toBeInTheDocument();
  });

  it("외곽 폭과 윤곽 비대칭을 비교한다", () => {
    renderScreen(
      newCapture({ dipContourObservation: contour() }),
      newCapture({ dipContourObservation: contour({ dipWidthRatio: 1.08, contourAsymmetryRatio: 0.1 }) })
    );
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getByText("95%")).toBeInTheDocument();
    expect(within(row).getByText("108%")).toBeInTheDocument();
    expect(within(row).getByText("10% 엄지쪽")).toBeInTheDocument(); // 부호 대신 방향(P0-12.1 §3)
  });

  it("평균 ROM·구형 손가락 각도를 주 비교로 쓰지 않는다", () => {
    const { container } = renderScreen(newCapture(), newCapture());
    expect(container.textContent).not.toMatch(/평균 ROM/);
    expect(container.textContent).not.toMatch(/검지 각도/);
  });

  it("좋아짐·나빠짐을 자동 판정하지 않는다", () => {
    const { container } = renderScreen(newCapture(), newCapture());
    // "악화를 판정하지 않습니다" 같은 면책 문구는 정상이다. 판정 결과 표현만 없어야 한다.
    expect(container.textContent).not.toMatch(/좋아졌|나빠졌|호전됨|악화됨|개선됨|정상 범위/);
  });
});

describe("값 표시 규칙 (§3)", () => {
  it("실제 0은 0°로 표시한다", () => {
    renderScreen(newCapture({ perFingerJointObservation: [joint({ dipExtensionPoseFlexionDeg: 0 })] }), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getByText("0°")).toBeInTheDocument();
  });

  it("값 누락은 —로 표시하고 0으로 바꾸지 않는다", () => {
    renderScreen(newCapture({ perFingerJointObservation: [joint({ dipActiveRomDeg: null })] }), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("외곽 관찰이 없으면 —로 표시한다", () => {
    renderScreen(newCapture(), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(4); // 외곽 2행 × 2열
  });
});

describe("세대 불일치 (§4)", () => {
  it("구형 기준선의 관절 항목은 '이전 방식 기록'으로 표시한다", () => {
    renderScreen(legacyCapture(), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getAllByText("이전 방식 기록").length).toBeGreaterThan(0);
  });

  it("신규 현재값은 정상 표시된다", () => {
    renderScreen(legacyCapture(), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    expect(within(row).getByText("18°")).toBeInTheDocument();
  });

  it("구형 0°를 신형 수치로 위장하지 않는다", () => {
    renderScreen(legacyCapture(), newCapture());
    const row = screen.getByTestId("compare-finger-index");
    // 기준선 열에 0°가 관절값처럼 나타나면 안 된다
    expect(within(row).queryByText("0°")).toBeNull();
  });

  it("비교 불가 사유와 안내 문구를 보여준다", () => {
    renderScreen(legacyCapture(), newCapture());
    expect(
      screen.getAllByText(/측정 방식이 달라 관절별 수치를 직접 비교하지 않습니다/).length
    ).toBeGreaterThan(0);
  });
});

describe("legacy ↔ legacy", () => {
  it("양쪽 모두 구형이면 평균 ROM을 보조로 보여준다", () => {
    renderScreen(legacyCapture({ averageObservedRomDeg: 110 }), legacyCapture({ averageObservedRomDeg: 118 }));
    expect(screen.getByText("평균 ROM")).toBeInTheDocument();
    expect(screen.getByText("110°")).toBeInTheDocument();
    expect(screen.getByText("118°")).toBeInTheDocument();
  });
});

describe("회귀", () => {
  it("증상 비교는 그대로 동작한다", () => {
    renderScreen(newCapture(), newCapture({ symptomSnapshot: { painSelfReport: 2, stiffnessSelfReport: 1 } }));
    expect(screen.getByText("통증 체감")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("사용 손을 표시한다", () => {
    renderScreen(newCapture({ handSide: "left" }), newCapture({ handSide: "left" }));
    expect(screen.getAllByText("왼손").length).toBe(2);
  });

  it("손이 다르면 비교 불가 사유를 보여준다", () => {
    renderScreen(newCapture({ handSide: "left" }), newCapture({ handSide: "right" }));
    expect(screen.getByText("촬영한 손이 서로 달라요")).toBeInTheDocument();
  });

  it("붓기 원인 판정 문구를 쓰지 않는다", () => {
    const { container } = renderScreen(
      newCapture({ dipContourObservation: contour() }),
      newCapture({ dipContourObservation: contour() })
    );
    expect(container.textContent).toMatch(/원인을 판정하지 않습니다/);
    expect(container.textContent).not.toMatch(/붓기 측정 완료|염증|진단/);
  });
});

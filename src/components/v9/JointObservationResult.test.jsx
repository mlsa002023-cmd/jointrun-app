// JointObservationResult — DIP 우선 표시 (RC1.2.2 P0-8 §8)
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import JointObservationResult from "./JointObservationResult";

const joints = [
  {
    key: "index", name: "검지",
    dipExtensionPoseFlexionDeg: 18.4, dipExtensionPoseDeviationDeg: -7.2,
    dipDeviationDirection: "ulnar", dipMaxFlexionDeg: 62.1, dipActiveRomDeg: 43.7,
    pipExtensionPoseFlexionDeg: 12, pipExtensionPoseDeviationDeg: 2.1,
    pipDeviationDirection: "radial", pipMaxFlexionDeg: 88.3, pipActiveRomDeg: 76.3,
    dipObserved: true, pipObserved: true,
  },
  {
    key: "middle", name: "중지",
    dipExtensionPoseFlexionDeg: 3, dipExtensionPoseDeviationDeg: 0.4,
    dipDeviationDirection: "neutral", dipMaxFlexionDeg: 70, dipActiveRomDeg: 67,
    pipExtensionPoseFlexionDeg: 2, pipExtensionPoseDeviationDeg: 0.2,
    pipDeviationDirection: "neutral", pipMaxFlexionDeg: 90, pipActiveRomDeg: 88,
    dipObserved: true, pipObserved: true,
  },
];

describe("JointObservationResult", () => {
  it("DIP를 먼저 제목으로 보여준다", () => {
    render(<JointObservationResult joints={joints} />);
    expect(screen.getByText(/끝마디\(DIP\) 관찰/)).toBeInTheDocument();
  });

  it("손가락별로 편 상태 굽힘·치우침·활동 범위를 보여준다", () => {
    render(<JointObservationResult joints={joints} />);
    const row = screen.getByTestId("joint-row-index");
    expect(within(row).getByText("18°")).toBeInTheDocument();   // 편 상태 DIP 굽힘
    expect(within(row).getByText("7° 새끼쪽")).toBeInTheDocument(); // 편위 크기+방향
    expect(within(row).getByText("44°")).toBeInTheDocument();   // DIP 활동 범위
  });

  it("PIP는 보조 관찰값으로 함께 표시한다", () => {
    render(<JointObservationResult joints={joints} />);
    const row = screen.getByTestId("joint-row-index");
    expect(within(row).getByText(/중간마디\(PIP\)/)).toBeInTheDocument();
  });

  it("치우침이 없으면 방향을 단정하지 않는다", () => {
    render(<JointObservationResult joints={joints} />);
    const row = screen.getByTestId("joint-row-middle");
    // DIP 값과 PIP 보조 줄 양쪽에 나타난다 — 어느 쪽도 방향을 단정하지 않아야 한다.
    expect(within(row).getAllByText(/치우침 없음/).length).toBeGreaterThan(0);
  });

  it("평균 ROM 같은 요약 수치를 메인에 넣지 않는다", () => {
    const { container } = render(<JointObservationResult joints={joints} />);
    expect(container.textContent).not.toMatch(/평균|관찰된 ROM/);
  });

  it("진단·정상범위 표현을 쓰지 않는다", () => {
    const { container } = render(<JointObservationResult joints={joints} />);
    expect(container.textContent).not.toMatch(/정상|비정상|악화|이상|위험|질환|권장|병원/);
  });

  it("끝마디를 관찰하지 못한 손가락은 그 사실을 표시한다", () => {
    render(<JointObservationResult joints={[{ ...joints[0], dipObserved: false }]} />);
    expect(screen.getByText("끝마디 관찰 어려움")).toBeInTheDocument();
  });

  it("값이 없으면 안내 문구를 보여주고 깨지지 않는다", () => {
    render(<JointObservationResult joints={[]} />);
    expect(screen.getByText(/계산하지 못했습니다/)).toBeInTheDocument();
  });

  it("가동범위를 관찰하지 못하면 0°가 아니라 '관찰 어려움'으로 표시한다", () => {
    render(<JointObservationResult joints={[{ ...joints[0], dipActiveRomDeg: null }]} />);
    const row = screen.getByTestId("joint-row-index");
    expect(within(row).getAllByText("관찰 어려움").length).toBeGreaterThan(0);
    expect(within(row).queryByText("0°")).toBeNull();
  });

  it("측정되지 않은 각도는 —로 표시한다", () => {
    render(<JointObservationResult joints={[{ ...joints[0], dipExtensionPoseFlexionDeg: null }]} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

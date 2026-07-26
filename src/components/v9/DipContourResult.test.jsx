// DipContourResult — DIP 외곽 폭 표시 (RC1.2.2 P0-9 §8)
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DipContourResult from "./DipContourResult";

const observation = {
  measurementVersion: "dip-contour-v1",
  fingers: [
    { key: "index", name: "검지", dipWidthRatio: 1.24, radialHalfWidthRatio: 0.68,
      ulnarHalfWidthRatio: 0.56, contourAsymmetryRatio: 0.1, validFrames: 9, stabilityMad: 0.02 },
    { key: "middle", name: "중지", dipWidthRatio: 1.02, radialHalfWidthRatio: 0.52,
      ulnarHalfWidthRatio: 0.5, contourAsymmetryRatio: 0.02, validFrames: 10, stabilityMad: 0.01 },
  ],
  qualityFlags: [],
};

describe("DipContourResult", () => {
  it("요구된 제목 문구를 쓴다", () => {
    render(<DipContourResult observation={observation} />);
    expect(screen.getByText(/인접 마디 대비 외곽 폭 관찰값/)).toBeInTheDocument();
    // 라벨은 두 줄로 나뉘어 렌더링되므로 요소 단위가 아니라 전체 텍스트로 확인한다.
    expect(screen.getByTestId("dip-contour-result").textContent.replace(/\s+/g, "")).toContain("좌우윤곽비대칭");
  });

  it("원인을 판정하지 않는다는 문구를 함께 보여준다", () => {
    render(<DipContourResult observation={observation} />);
    expect(
      screen.getByText(/이 값은 질환이나 붓기의 원인을 판정하지 않습니다/)
    ).toBeInTheDocument();
  });

  it("손가락별 폭 비율과 좌우 반폭을 보여준다", () => {
    render(<DipContourResult observation={observation} />);
    const row = screen.getByTestId("dip-contour-row-index");
    expect(within(row).getByText("124%")).toBeInTheDocument();
    // P0-12.1 §4 — 반폭은 기본 화면에서 숨긴다.
    expect(within(row).queryByText("68% / 56%")).toBeNull();
    expect(within(row).getByText("9프레임")).toBeInTheDocument();
  });

  it("비대칭은 크기와 방향으로 적는다", () => {
    render(<DipContourResult observation={observation} />);
    expect(within(screen.getByTestId("dip-contour-row-index")).getByText("10% 엄지쪽")).toBeInTheDocument();
    expect(within(screen.getByTestId("dip-contour-row-middle")).getByText("2% 치우침 없음")).toBeInTheDocument();
  });

  it("관찰에 실패하면 0을 보여주지 않고 재측정을 안내한다", () => {
    render(<DipContourResult observation={null} flags={["dip_low_background_contrast"]} />);
    const box = screen.getByTestId("dip-contour-retake");
    expect(within(box).getByText(/다시 촬영해 주세요/)).toBeInTheDocument();
    expect(box.textContent).not.toMatch(/\b0%/);
  });

  it("재측정 버튼을 누르면 콜백이 호출된다", () => {
    const onRetake = vi.fn();
    render(<DipContourResult observation={null} onRetake={onRetake} />);
    fireEvent.click(screen.getByText("다시 촬영하기"));
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it("의료 진단·붓기 판정 문구를 쓰지 않는다", () => {
    const { container } = render(<DipContourResult observation={observation} />);
    expect(container.textContent).not.toMatch(/붓기 측정 완료|염증|관절염|진단|정상 범위|악화/);
  });
});

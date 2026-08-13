// ObservationSummaryCard — 한줄 요약 카드 (RC1.2.2 P0-12 §11)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ObservationSummaryCard from "./ObservationSummaryCard";

const summary = {
  title: "이번 기록 한줄 요약",
  headline: "이번 기준선에서는 약지 끝마디 말림과 소지의 엄지쪽 치우침이 상대적으로 크게 기록됐어요.",
  secondaryText: "다음 측정에서는 약지와 소지를 우선 비교합니다.",
  focusFingerKeys: ["ring", "pinky"],
  summaryCode: "baseline_dip_flexion_and_deviation_focus",
  confidence: "observed",
  comparable: false,
};

describe("ObservationSummaryCard", () => {
  it("제목과 headline을 보여준다", () => {
    render(<ObservationSummaryCard summary={summary} />);
    expect(screen.getByText(summary.title)).toBeInTheDocument();
    expect(screen.getByTestId("observation-summary-headline")).toHaveTextContent(/약지 끝마디 말림/);
  });

  it("보조 문장을 보여준다", () => {
    render(<ObservationSummaryCard summary={summary} />);
    expect(screen.getByText(summary.secondaryText)).toBeInTheDocument();
  });

  it("요약이 없으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<ObservationSummaryCard summary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("summaryCode 같은 내부 값을 화면에 노출하지 않는다", () => {
    const { container } = render(<ObservationSummaryCard summary={summary} />);
    expect(container.textContent).not.toMatch(/baseline_dip_flexion|observed|focusFingerKeys/);
  });

  it("가로 스크롤을 만드는 고정 폭을 쓰지 않는다", () => {
    render(<ObservationSummaryCard summary={summary} />);
    const card = screen.getByTestId("observation-summary");
    expect(card.style.maxWidth).toBe("100%");
    expect(card.style.width).toBe("");
  });

  it("제목을 접근성 레이블로 제공한다", () => {
    render(<ObservationSummaryCard summary={summary} />);
    expect(screen.getByLabelText(summary.title)).toBeInTheDocument();
  });
});

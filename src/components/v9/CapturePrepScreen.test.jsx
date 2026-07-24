// RC1.2 §9-1 — 왼손/오른손을 선택하기 전에는 측정(촬영)을 시작할 수 없다.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CapturePrepScreen from "./CapturePrepScreen";

describe("CapturePrepScreen — handSide 필수", () => {
  it("손을 선택하기 전에는 '촬영 시작하기'가 비활성이고 onSubmit이 호출되지 않는다", () => {
    const onSubmit = vi.fn();
    render(<CapturePrepScreen onSubmit={onSubmit} onCancel={() => {}} />);
    const start = screen.getByRole("button", { name: "촬영 시작하기" });
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("손을 선택하면 활성화되고 handSide와 함께 onSubmit이 호출된다", () => {
    const onSubmit = vi.fn();
    render(<CapturePrepScreen onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "오른손" }));
    const start = screen.getByRole("button", { name: "촬영 시작하기" });
    expect(start).not.toBeDisabled();
    fireEvent.click(start);
    expect(onSubmit).toHaveBeenCalledWith({ handSide: "right" });
  });
});

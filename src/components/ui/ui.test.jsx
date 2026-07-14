import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Camera } from "lucide-react";
import { JTCard, JTButton, JTSection, JTListItem, JTEmptyState, JTSkeleton } from "./index";

describe("design system components", () => {
  it("JTCard renders children", () => {
    render(<JTCard>내용</JTCard>);
    expect(screen.getByText("내용")).toBeInTheDocument();
  });

  it("JTButton fires onClick and respects disabled", () => {
    const onClick = vi.fn();
    render(<JTButton onClick={onClick}>저장</JTButton>);
    fireEvent.click(screen.getByText("저장"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("JTButton disabled blocks click", () => {
    const onClick = vi.fn();
    render(<JTButton disabled onClick={onClick}>저장</JTButton>);
    fireEvent.click(screen.getByText("저장"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("JTSection renders title and content", () => {
    render(<JTSection title="전체 기록"><p>항목 1</p></JTSection>);
    expect(screen.getByText("전체 기록")).toBeInTheDocument();
    expect(screen.getByText("항목 1")).toBeInTheDocument();
  });

  it("JTListItem renders as a clickable button when as='button'", () => {
    const onClick = vi.fn();
    render(<JTListItem as="button" icon={Camera} label="병원 방문" onClick={onClick} />);
    fireEvent.click(screen.getByText("병원 방문"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("JTEmptyState compact renders description only", () => {
    render(<JTEmptyState variant="compact" description="아직 기록이 없습니다." />);
    expect(screen.getByText("아직 기록이 없습니다.")).toBeInTheDocument();
  });

  it("JTEmptyState full renders title + CTA", () => {
    const onAction = vi.fn();
    render(<JTEmptyState variant="full" title="아직 기록이 없어요" actionLabel="첫 스캔 시작하기" onAction={onAction} />);
    fireEvent.click(screen.getByText("첫 스캔 시작하기"));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("JTSkeleton renders the requested number of blocks", () => {
    const { container } = render(<JTSkeleton count={3} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
});

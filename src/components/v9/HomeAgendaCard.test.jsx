// HomeAgendaCard — 측정 완료 → "다음 단계로" 이후 홈 카드가 자동으로 scroll·focus·강조되는지 검증.
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HomeAgendaCard from "./HomeAgendaCard";

beforeEach(() => {
  // jsdom에는 scrollIntoView가 없어 명시적으로 채운다(호출 여부 확인).
  Element.prototype.scrollIntoView = vi.fn();
});

const baseAgenda = { key: "no_baseline", label: "첫 기준선 만들기" };

describe("HomeAgendaCard focus/scroll", () => {
  it("focusSignal이 0이면 스크롤·onFocused를 트리거하지 않는다", () => {
    const onFocused = vi.fn();
    render(<HomeAgendaCard agenda={baseAgenda} focusSignal={0} onFocused={onFocused} />);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(onFocused).not.toHaveBeenCalled();
  });

  it("focusSignal이 올라오면 카드로 scroll·focus하고 onFocused를 호출한다", () => {
    const onFocused = vi.fn();
    render(<HomeAgendaCard agenda={baseAgenda} focusSignal={1} onFocused={onFocused} />);
    const card = screen.getByLabelText("지금 필요한 기록");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(card); // 포커스가 카드로 이동
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it("agenda 라벨을 헤드라인으로 보여준다", () => {
    render(<HomeAgendaCard agenda={{ key: "week2_waiting", label: "다음 재확인까지 D-5" }} />);
    expect(screen.getByText("다음 재확인까지 D-5")).toBeInTheDocument();
  });
});

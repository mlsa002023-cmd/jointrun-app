import { describe, it, expect } from "vitest";
import { computeRecheckDueDates, getRecheckWindowState, daysUntil, getHomeAgendaState } from "./recheckSchedule";

describe("computeRecheckDueDates", () => {
  it("기준선 시각으로부터 2주·4주 뒤 날짜를 계산한다", () => {
    const baseline = new Date("2026-01-01T00:00:00Z");
    const { week2DueAt, week4DueAt } = computeRecheckDueDates(baseline);
    expect(week2DueAt.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(week4DueAt.toISOString().slice(0, 10)).toBe("2026-01-29");
  });
});

describe("getRecheckWindowState", () => {
  const due = new Date("2026-01-15T00:00:00Z");

  it("허용 창 이전이면 scheduled", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(getRecheckWindowState(due, now)).toBe("scheduled");
  });

  it("허용 창(±3일) 안이면 due", () => {
    expect(getRecheckWindowState(due, new Date("2026-01-13T00:00:00Z"))).toBe("due");
    expect(getRecheckWindowState(due, new Date("2026-01-15T00:00:00Z"))).toBe("due");
    expect(getRecheckWindowState(due, new Date("2026-01-18T00:00:00Z"))).toBe("due");
  });

  it("허용 창을 지나면 expired", () => {
    expect(getRecheckWindowState(due, new Date("2026-01-20T00:00:00Z"))).toBe("expired");
  });
});

describe("daysUntil", () => {
  it("자정 기준 일수 차이를 반올림 없이 정확히 센다", () => {
    // 로컬 타임존 자정 기준으로 세므로, 테스트도 UTC 지정 없이 로컬 시각으로 만든다.
    const now = new Date(2026, 0, 10, 15, 0, 0);
    const due = new Date(2026, 0, 15, 2, 0, 0);
    expect(daysUntil(due, now)).toBe(5);
  });
});

describe("getHomeAgendaState — 04_APP_PRD_V9.md S07", () => {
  it("기준선이 없으면 첫 기준선 만들기 안내", () => {
    expect(getHomeAgendaState(null).key).toBe("no_baseline");
  });

  it("2주 재확인이 창 안에 들어오면 recheck_ready", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const event = { status: "baseline_created", rechecks: [
      { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "scheduled" },
      { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
    ] };
    expect(getHomeAgendaState(event, now).key).toBe("recheck_ready");
  });

  it("2주 재확인 전이면 D-day 카운트다운을 보여준다", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const event = { status: "baseline_created", rechecks: [
      { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "scheduled" },
      { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
    ] };
    const agenda = getHomeAgendaState(event, now);
    expect(agenda.key).toBe("week2_waiting");
    expect(agenda.label).toContain("D-10");
  });

  it("2주 완료 후 4주 재확인 대기 상태를 보여준다", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    const event = { status: "rechecked", rechecks: [
      { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "completed" },
      { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
    ] };
    expect(getHomeAgendaState(event, now).key).toBe("week4_waiting");
  });

  it("4주까지 완료되면 결과 기록을 요청한다", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const event = { status: "compared", rechecks: [
      { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "completed" },
      { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "completed" },
    ] };
    expect(getHomeAgendaState(event, now).key).toBe("awaiting_decision");
  });
});

describe("getHomeAgendaState — 촬영 품질 예외 처리(qualityWarning)", () => {
  it("정상(pass) 기준선/재확인이면 경고가 없다", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const event = {
      status: "baseline_created",
      baselineQualityStatus: "pass",
      rechecks: [
        { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "scheduled" },
        { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
      ],
    };
    expect(getHomeAgendaState(event, now).qualityWarning).toBeNull();
  });

  it("기준선이 강제저장(unreliable)이면 재촬영을 제안하는 경고를 보여준다", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const event = {
      status: "baseline_created",
      baselineQualityStatus: "unreliable",
      rechecks: [
        { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "scheduled" },
        { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
      ],
    };
    expect(getHomeAgendaState(event, now).qualityWarning).toMatch(/기준선/);
  });

  it("가장 최근 완료된 재확인이 강제저장(unreliable)이면 경고를 보여준다", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    const event = {
      status: "rechecked",
      baselineQualityStatus: "pass",
      rechecks: [
        { dueType: "week2", dueAt: new Date("2026-01-15T00:00:00Z"), status: "completed", qualityStatus: "unreliable" },
        { dueType: "week4", dueAt: new Date("2026-01-29T00:00:00Z"), status: "scheduled" },
      ],
    };
    expect(getHomeAgendaState(event, now).qualityWarning).toMatch(/재확인/);
  });
});

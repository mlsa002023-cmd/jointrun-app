import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMonthlyReportData } from "./useMonthlyReportData";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

const now = new Date();
const thisMonth = (day) => new Date(now.getFullYear(), now.getMonth(), day);
const otherMonth = (day) => new Date(now.getFullYear(), now.getMonth() - 2, day);

describe("useMonthlyReportData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("summarizes only this month's scans/events, grouped and selected correctly", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([
      { id: "s1", createdAt: { toDate: () => thisMonth(2) }, scores: { total: 60 } },
      { id: "s2", createdAt: { toDate: () => thisMonth(9) }, scores: { total: 65 } },
      { id: "s3", createdAt: { toDate: () => thisMonth(16) }, scores: { total: 70 } },
      { id: "s4", createdAt: { toDate: () => thisMonth(23) }, scores: { total: 90 } },
      { id: "s0", createdAt: { toDate: () => otherMonth(15) }, scores: { total: 40 } }, // 다른 달 — 제외돼야 함
    ]);
    firestoreLib.getEventHistory.mockResolvedValue([
      { id: "e1", timestamp: { toDate: () => thisMonth(5) }, type: "exercise_start", label: "운동 시작" },
      { id: "e2", timestamp: { toDate: () => thisMonth(12) }, type: "exercise_start", label: "운동 시작" },
      { id: "e3", timestamp: { toDate: () => thisMonth(20) }, type: "hospital_visit", label: "병원 방문" },
      { id: "e0", timestamp: { toDate: () => otherMonth(10) }, type: "medication_start", label: "약 복용 시작" }, // 다른 달 — 제외돼야 함
    ]);

    const { result } = renderHook(() => useMonthlyReportData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 1. 월간 요약 문장 — 4개 상태 중 하나, 관찰형 메시지 존재
    expect(["insufficient", "stable", "volatile", "declining"]).toContain(result.current.summary.status);
    expect(result.current.summary.message.length).toBeGreaterThan(0);

    // 2. 월간 평균 추이 — 다른 달 스캔은 제외되고 이번 달 4건만 주차별로 집계됨
    const totalCount = result.current.trend.weeks.reduce((sum, w) => sum + w.count, 0);
    expect(totalCount).toBe(4);
    expect(result.current.trend.hasData).toBe(true);

    // 3. Event 요약 — exercise_start 2건이 한 그룹으로, 다른 달 이벤트는 제외
    expect(result.current.eventGroups).toHaveLength(2);
    const exerciseGroup = result.current.eventGroups.find((g) => g.type === "exercise_start");
    expect(exerciseGroup.count).toBe(2);
    expect(result.current.eventGroups.some((g) => g.type === "medication_start")).toBe(false);

    // 4. 대표 변화 1건 — 전후 델타가 가장 큰 hospital_visit(day20)이 선택됨
    expect(result.current.highlight.event.type).toBe("hospital_visit");
    expect(result.current.highlight.delta).toBeCloseTo(25);
  });

  it("returns null highlight and empty groups when there are no events this month", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([]);
    firestoreLib.getEventHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useMonthlyReportData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary.status).toBe("insufficient");
    expect(result.current.trend.hasData).toBe(false);
    expect(result.current.eventGroups).toHaveLength(0);
    expect(result.current.highlight).toBeNull();
  });
});

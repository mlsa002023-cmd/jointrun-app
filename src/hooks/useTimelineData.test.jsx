import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTimelineData } from "./useTimelineData";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

describe("useTimelineData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads scans+events and exposes a merged timelineItems list", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([
      { id: "s1", createdAt: { toDate: () => new Date("2026-07-10") }, scores: { total: 70 } },
    ]);
    firestoreLib.getEventHistory.mockResolvedValue([
      { id: "e1", timestamp: { toDate: () => new Date("2026-07-12") }, label: "운동 시작", type: "exercise_start" },
    ]);

    const { result } = renderHook(() => useTimelineData());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scans).toHaveLength(1);
    expect(result.current.events).toHaveLength(1);
    expect(result.current.timelineItems).toHaveLength(2);
    expect(result.current.timelineItems[0].kind).toBe("event"); // 더 최신
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRecordRepository } from "./recordRepository";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));

describe("recordRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty/null for all methods when uid is missing", async () => {
    const repo = createRecordRepository(undefined);
    expect(await repo.getRecentScans()).toEqual([]);
    expect(await repo.getEvents()).toEqual([]);
    expect(await repo.getTimeline()).toEqual([]);
    expect(await repo.addEvent({})).toBeNull();
    expect(firestoreLib.getScanHistory).not.toHaveBeenCalled();
  });

  it("getRecentScans delegates to getScanHistory with uid+count", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([{ id: "s1" }]);
    const repo = createRecordRepository("u1");
    const result = await repo.getRecentScans(10);
    expect(firestoreLib.getScanHistory).toHaveBeenCalledWith("u1", 10);
    expect(result).toEqual([{ id: "s1" }]);
  });

  it("getEvents delegates to getEventHistory with uid+count", async () => {
    firestoreLib.getEventHistory.mockResolvedValue([{ id: "e1" }]);
    const repo = createRecordRepository("u1");
    const result = await repo.getEvents(5);
    expect(firestoreLib.getEventHistory).toHaveBeenCalledWith("u1", 5);
    expect(result).toEqual([{ id: "e1" }]);
  });

  it("getTimeline merges scans+events, most recent first", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([
      { id: "s1", createdAt: { toDate: () => new Date("2026-07-10") }, scores: { total: 70 } },
    ]);
    firestoreLib.getEventHistory.mockResolvedValue([
      { id: "e1", timestamp: { toDate: () => new Date("2026-07-11") }, label: "병원 방문", type: "hospital_visit" },
    ]);
    const repo = createRecordRepository("u1");
    const timeline = await repo.getTimeline();
    expect(timeline).toHaveLength(2);
    expect(timeline[0].kind).toBe("event");
    expect(timeline[1].kind).toBe("scan");
  });

  it("addEvent delegates to saveEvent", async () => {
    firestoreLib.saveEvent.mockResolvedValue("new-id");
    const repo = createRecordRepository("u1");
    const id = await repo.addEvent({ type: "custom", label: "test" });
    expect(firestoreLib.saveEvent).toHaveBeenCalledWith("u1", { type: "custom", label: "test" });
    expect(id).toBe("new-id");
  });
});

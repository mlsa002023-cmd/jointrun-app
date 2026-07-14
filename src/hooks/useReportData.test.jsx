import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useReportData } from "./useReportData";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

describe("useReportData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads scans for pattern detection", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
    const { result } = renderHook(() => useReportData());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scans).toHaveLength(2);
  });
});

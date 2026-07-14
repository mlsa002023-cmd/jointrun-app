import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHomeData } from "./useHomeData";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

describe("useHomeData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts loading, then resolves scanCount + mobilityTrendUp", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([
      { scores: { mobility: { value: 80 } } },
      { scores: { mobility: { value: 60 } } },
    ]);
    const { result } = renderHook(() => useHomeData());
    expect(result.current.loading).toBe(true);
    expect(result.current.scanCount).toBe(null);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scanCount).toBe(2);
    expect(result.current.mobilityTrendUp).toBe(true);
  });

  it("mobilityTrendUp is false with fewer than 2 scans", async () => {
    firestoreLib.getScanHistory.mockResolvedValue([{ scores: { mobility: { value: 80 } } }]);
    const { result } = renderHook(() => useHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mobilityTrendUp).toBe(false);
  });
});

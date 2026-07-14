import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventMarkerModal from "./EventMarkerModal";
import * as firestoreLib from "../lib/firestore";

vi.mock("../lib/firestore", () => ({
  getScanHistory: vi.fn(),
  getEventHistory: vi.fn(),
  saveEvent: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

describe("EventMarkerModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a fixed type via recordRepository → Firestore DataSource", async () => {
    firestoreLib.saveEvent.mockResolvedValue("new-id");
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<EventMarkerModal onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText("병원 방문"));

    await waitFor(() => expect(firestoreLib.saveEvent).toHaveBeenCalled());
    expect(firestoreLib.saveEvent).toHaveBeenCalledWith("u1", expect.objectContaining({ type: "hospital_visit", label: "병원 방문" }));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("custom type requires a label before Save is enabled", async () => {
    firestoreLib.saveEvent.mockResolvedValue("new-id");
    render(<EventMarkerModal onClose={() => {}} onSaved={() => {}} />);

    fireEvent.click(screen.getByText("직접 입력"));
    const saveButton = screen.getByText("저장");
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("예: 스트레칭 시작"), { target: { value: "냉찜질 15분" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    await waitFor(() => expect(firestoreLib.saveEvent).toHaveBeenCalledWith("u1", expect.objectContaining({ type: "custom", label: "냉찜질 15분" })));
  });
});

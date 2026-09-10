import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  // Minimal stubs for other Alerts storage calls (extensible for later tasks)
  toggleAlert: vi.fn().mockResolvedValue(undefined),
  removeAlert: vi.fn().mockResolvedValue(undefined),
  rearmAlert: vi.fn().mockResolvedValue(undefined),
  snoozeAlert: vi.fn().mockResolvedValue(undefined),
  updateAlert: vi.fn().mockResolvedValue(undefined),
  addBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeStockWatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Alerts } from "../src/pages/Alerts";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getNotificationHistory.mockRejectedValue(new Error("boom"));
  mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
});

describe("alerts error paths", () => {
  it("toasts and offers Retry when notification history fails to load", async () => {
    render(<MemoryRouter><Alerts /></MemoryRouter>);
    // Notifications list lives under the notifications tab
    const tabButton = await screen.findByRole("button", { name: /show notifications/i });
    await userEvent.click(tabButton);
    await waitFor(() => expect(screen.getByText(/couldn't load notifications/i)).toBeInTheDocument());
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(mockStorage.getNotificationHistory).toHaveBeenCalledTimes(2));
  });
});

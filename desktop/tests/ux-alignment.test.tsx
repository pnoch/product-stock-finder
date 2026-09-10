import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  // Extensible stubs for later tasks (mirrors error-paths-safety.test.tsx)
  toggleAlert: vi.fn().mockResolvedValue(undefined),
  removeAlert: vi.fn().mockResolvedValue(undefined),
  rearmAlert: vi.fn().mockResolvedValue(undefined),
  snoozeAlert: vi.fn().mockResolvedValue(undefined),
  updateAlert: vi.fn().mockResolvedValue(undefined),
  addBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeStockWatch: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  getTagDefinitions: vi.fn().mockResolvedValue({}),
  getSyncMeta: vi.fn().mockResolvedValue({ lastSyncedAt: 0, items: {} }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Alerts } from "../src/pages/Alerts";
import { Watchlist } from "../src/pages/Watchlist";

function renderAlerts() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter><Alerts /></MemoryRouter></QueryClientProvider>);
  return qc;
}

function renderWatchlist() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter><Watchlist /></MemoryRouter></QueryClientProvider>);
  return qc;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("alerts tab count", () => {
  it("counts only active, untriggered, unsnoozed alerts", async () => {
    const snoozed = new Date(Date.now() + 86400000).toISOString();
    const now = new Date().toISOString();
    mockStorage.getAlerts.mockResolvedValue([
      { id: "a1", productId: "p", targetPrice: 10, currency: "USD", isActive: true, createdAt: now },
      { id: "a2", productId: "p", targetPrice: 10, currency: "USD", isActive: true, createdAt: now, triggeredAt: now },
      { id: "a3", productId: "p", targetPrice: 10, currency: "USD", isActive: true, createdAt: now, snoozedUntil: snoozed },
      { id: "a4", productId: "p", targetPrice: 10, currency: "USD", isActive: false, createdAt: now },
    ]);
    renderAlerts();
    await waitFor(() => expect(screen.getByRole("button", { name: /show price alerts/i })).toHaveTextContent("Alerts (1)"));
  });
});

describe("deal sort persistence", () => {
  it("persists the deal sort to settings", async () => {
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "CRS326-24G-2S+RM",
        modelNumber: "CRS326-24G-2S+RM",
        brand: "MikroTik",
        category: "Switch",
        description: "",
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
      },
    ]);
    mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
    const qc = renderWatchlist();
    const sortButton = await screen.findByRole("button", { name: "Sort by Deal" });
    await waitFor(() => expect(mockStorage.saveSettings).toHaveBeenCalled());
    mockStorage.saveSettings.mockClear();
    fireEvent.click(sortButton);
    await waitFor(() =>
      expect(mockStorage.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ watchlistSortKey: "deal" }),
      ),
    );
    qc.clear();
  });
});

describe("notifications refresh", () => {
  it("refreshes notifications on demand", async () => {
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
    const qc = renderAlerts();
    try {
      const tabButton = await screen.findByRole("button", { name: /show notifications/i });
      fireEvent.click(tabButton);
      await waitFor(() => expect(mockStorage.getNotificationHistory).toHaveBeenCalled());
      mockStorage.getNotificationHistory.mockClear();
      const refreshButton = await screen.findByRole("button", { name: /refresh notifications/i });
      fireEvent.click(refreshButton);
      await waitFor(() => expect(mockStorage.getNotificationHistory).toHaveBeenCalledTimes(1));
    } finally {
      qc.clear();
    }
  });
});

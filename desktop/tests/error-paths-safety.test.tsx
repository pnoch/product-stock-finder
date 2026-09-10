import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  // Watchlist bulk-tag sheet storage calls
  getTagDefinitions: vi.fn(),
  getSyncMeta: vi.fn(),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

// jsdom cannot measure scroll containers, so the virtualized watchlist table
// renders zero rows. Render every row so selection checkboxes are clickable.
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...mod,
    useVirtualizer: (opts: { count: number }) => ({
      getVirtualItems: () =>
        Array.from({ length: opts.count }, (_, index) => ({
          key: index,
          index,
          start: index * 76,
          end: index * 76 + 76,
          size: 76,
        })),
      getTotalSize: () => opts.count * 76,
      measureElement: () => {},
    }),
  };
});

import { Alerts } from "../src/pages/Alerts";
import { Watchlist } from "../src/pages/Watchlist";
import { RestockWatches } from "../src/pages/RestockWatches";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getNotificationHistory.mockRejectedValue(new Error("boom"));
  mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
  mockStorage.getTagDefinitions.mockResolvedValue({});
  mockStorage.getSyncMeta.mockResolvedValue({ lastSyncedAt: 0, items: {} });
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

describe("watchlist bulk-tag error path", () => {
  it("toasts when tag definitions fail to load", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
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
    mockStorage.getTagDefinitions.mockRejectedValue(new Error("boom"));
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Watchlist />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByLabelText("Enter bulk select mode"));
    await userEvent.click(await screen.findByLabelText("Select CRS326-24G-2S+RM"));
    await userEvent.click(screen.getByRole("button", { name: "Tag" }));
    await waitFor(() => expect(screen.getByText(/couldn't load tags/i)).toBeInTheDocument());
    queryClient.clear();
  });
});

describe("delete confirmations", () => {
  const alertFixture = {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
    direction: "drop" as const,
    distributorId: null,
  };
  const reminderFixture = {
    id: "r1",
    productId: "p1",
    productName: "CRS326-24G-2S+RM",
    distributorId: "d1",
    distributorName: "TestDist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const watchFixture = {
    id: "w1",
    productId: "p1",
    productName: "CRS326-24G-2S+RM",
    distributorId: "d1",
    distributorName: "TestDist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  function mockAlertsPageData() {
    mockStorage.getAlerts.mockResolvedValue([alertFixture]);
    mockStorage.getBackOrderReminders.mockResolvedValue([reminderFixture]);
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    mockStorage.getWatchlist.mockResolvedValue([]);
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
  }

  it("does not delete an alert when the confirm is dismissed", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /delete price alert/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeAlert).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("deletes an alert when the confirm is accepted", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /delete price alert/i }));
      await waitFor(() => expect(mockStorage.removeAlert).toHaveBeenCalledWith("a1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });

  it("does not delete a reminder when the confirm is dismissed", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /show reminders/i }));
      await userEvent.click(await screen.findByRole("button", { name: /^delete reminder$/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeBackOrderReminder).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("deletes a reminder when the confirm is accepted", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /show reminders/i }));
      await userEvent.click(await screen.findByRole("button", { name: /^delete reminder$/i }));
      await waitFor(() => expect(mockStorage.removeBackOrderReminder).toHaveBeenCalledWith("r1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });

  it("does not remove a restock watch when the confirm is dismissed", async () => {
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><RestockWatches /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /remove CRS326-24G-2S\+RM from restock watches/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeStockWatch).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("removes a restock watch when the confirm is accepted", async () => {
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><RestockWatches /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /remove CRS326-24G-2S\+RM from restock watches/i }));
      await waitFor(() => expect(mockStorage.removeStockWatch).toHaveBeenCalledWith("w1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  getPriceDigestSnapshot: vi.fn().mockResolvedValue(null),
  savePriceDigestSnapshot: vi.fn().mockResolvedValue(undefined),
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
import { Stats } from "../src/pages/Stats";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateDaysAgo = (n: number) =>
  new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);

function makeProduct(
  id: string,
  name: string,
  distributorId: string,
  oldPrice: number,
  newPrice: number,
) {
  const now = new Date().toISOString();
  return {
    id,
    name,
    modelNumber: name,
    brand: "MikroTik",
    category: "Switch",
    description: "",
    addedAt: now,
    isWatched: true,
    listings: [
      {
        distributorId,
        productId: id,
        price: newPrice,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: now,
        priceHistory: [
          { date: dateDaysAgo(20), price: oldPrice, currency: "USD", stockStatus: "in_stock" },
          { date: dateDaysAgo(1), price: newPrice, currency: "USD", stockStatus: "in_stock" },
        ],
      },
    ],
  };
}

function renderAlerts(initialEntry = "/alerts?tab=reminders") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Alerts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return qc;
}

function renderStats() {
  render(
    <MemoryRouter initialEntries={["/stats"]}>
      <Stats />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockStorage.getPriceDigestSnapshot.mockResolvedValue(null);
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
});

describe("past-due reminder pills", () => {
  it("marks overdue reminders Past Due", async () => {
    const now = new Date().toISOString();
    mockStorage.getBackOrderReminders.mockResolvedValue([
      {
        id: "r-past",
        productId: "p1",
        productName: "Overdue Product",
        distributorId: "d1",
        distributorName: "Test Distributor",
        reminderDate: new Date(Date.now() - DAY_MS).toISOString(),
        createdAt: now,
      },
      {
        id: "r-future",
        productId: "p2",
        productName: "Upcoming Product",
        distributorId: "d1",
        distributorName: "Test Distributor",
        reminderDate: new Date(Date.now() + DAY_MS).toISOString(),
        createdAt: now,
      },
    ]);
    const qc = renderAlerts();
    try {
      await screen.findByText("Overdue Product");
      expect(screen.getByText("Upcoming Product")).toBeInTheDocument();
      expect(screen.getAllByText("Past Due")).toHaveLength(1);
    } finally {
      qc.clear();
    }
  });
});

describe("drop calendar details", () => {
  it("shows drop details on day select", async () => {
    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct("drop-a", "Drop Product Alpha", "balticnetworks-us", 100, 80),
      makeProduct("drop-b", "Drop Product Beta", "bhphoto-us", 100, 90),
    ]);
    renderStats();
    const key = dateDaysAgo(1);
    const cell = await screen.findByRole("gridcell", {
      name: new RegExp(`${key}: 2 drops`),
    });
    await userEvent.click(cell);
    const header = await screen.findByText(`Drops on ${key}`);
    expect(header).toBeInTheDocument();
    const panel = header.parentElement!;
    expect(panel.textContent).toMatch(/Drop Product Alpha/);
    expect(panel.textContent).toMatch(/→/);
    expect(panel.textContent).toMatch(/-20%/);
    expect(
      panel.querySelector('a[href="/product/drop-a"]'),
    ).not.toBeNull();
    await userEvent.click(cell);
    await waitFor(() =>
      expect(screen.queryByText(`Drops on ${key}`)).not.toBeInTheDocument(),
    );
  });
});

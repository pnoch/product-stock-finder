import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router";
import { formatPrice, convertPrice } from "@shared/currency";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
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
  updateProductListings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

vi.mock("../src/lib/api-base", () => ({
  getApiBaseUrl: () => "https://api.example.com",
  getOAuthPortalUrl: () => "",
  getAppId: () => "",
}));

vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    prices: { get: { query: vi.fn().mockResolvedValue(null) } },
    insights: { get: { query: vi.fn().mockResolvedValue(null) } },
  }),
}));

const mockTauriInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockTauriInvoke,
}));

import { Alerts } from "../src/pages/Alerts";
import { Watchlist } from "../src/pages/Watchlist";
import { ProductDetail } from "../src/pages/ProductDetail";

function NavigateHelper({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button aria-label={label} onClick={() => navigate(to)}>
      nav
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTauriInvoke.mockRejectedValue(new Error("no tauri"));
  localStorage.clear();
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getNotificationHistory.mockResolvedValue([]);
  mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.updateProductListings.mockResolvedValue(undefined);
});

afterEach(() => {
  delete (window as unknown as { __TAURI__?: boolean }).__TAURI__;
});

describe("nav header parity", () => {
  it("syncs tab when the query changes", async () => {
    const now = new Date().toISOString();
    mockStorage.getAlerts.mockResolvedValue([
      {
        id: "a1",
        productId: "p1",
        targetPrice: 100,
        currency: "USD",
        isActive: true,
        createdAt: now,
      },
    ]);
    mockStorage.getBackOrderReminders.mockResolvedValue([
      {
        id: "r1",
        productId: "p1",
        productName: "Reminder Product",
        distributorId: "d1",
        distributorName: "Test Distributor",
        reminderDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: now,
      },
    ]);
    mockStorage.getWatchlist.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={["/alerts?tab=alerts"]}>
        <Routes>
          <Route
            path="/alerts"
            element={
              <>
                <NavigateHelper to="/alerts?tab=reminders" label="go reminders" />
                <Alerts />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Alerts & Reminders")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "go reminders" }));
    await waitFor(() => expect(screen.getByText("Date Reminders")).toBeInTheDocument());
    expect(screen.getByText("Reminder Product")).toBeInTheDocument();
  });

  it("links summary to stats", async () => {
    const now = new Date().toISOString();
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "CRS326-24G-2S+RM",
        modelNumber: "CRS326-24G-2S+RM",
        brand: "MikroTik",
        category: "Switch",
        description: "",
        addedAt: now,
        isWatched: true,
        listings: [],
      },
    ]);
    mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/watchlist"]}>
          <Routes>
            <Route path="/watchlist" element={<Watchlist />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = await screen.findByRole("link", { name: "View statistics" });
    expect(link).toHaveAttribute("href", "/stats");
    qc.clear();
  });

  it("shows converted best price and payment methods", async () => {
    const now = new Date().toISOString();
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "CRS326-24G-2S+RM",
        modelNumber: "CRS326-24G-2S+RM",
        brand: "MikroTik",
        category: "Switch",
        description: "Test switch",
        addedAt: now,
        isWatched: true,
        listings: [
          {
            distributorId: "interprojekt-pl",
            productId: "p1",
            price: 100,
            currency: "EUR",
            stockStatus: "in_stock",
            url: "https://example.com/eu",
            lastChecked: now,
            priceHistory: [],
          },
        ],
      },
    ]);
    mockStorage.getSettings.mockResolvedValue({
      theme: "auto",
      displayCurrency: "USD",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      shippingRegion: "Asia-Pacific",
    });
    render(
      <MemoryRouter initialEntries={["/product/p1"]}>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const converted = convertPrice(100, "EUR", "USD") as number;
    await waitFor(() =>
      expect(
        screen.getByText(`${formatPrice(100, "EUR")} ≈ ${formatPrice(converted, "USD")}`),
      ).toBeInTheDocument(),
    );
    const rate = convertPrice(1, "EUR", "USD") as number;
    expect(screen.getByText(`1 EUR = ${rate.toFixed(4)} USD`)).toBeInTheDocument();
    expect(screen.getByText("💳 Online Payment · Bank Transfer · Credit Card")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { formatPrice, convertPrice } from "@shared/currency";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getStockWatches: vi.fn(),
  getAlerts: vi.fn(),
  updateProductListings: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

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

import { ProductDetail } from "../src/pages/ProductDetail";

const product = {
  id: "p1",
  name: "MikroTik hAP ac3",
  modelNumber: "hAP ac3",
  brand: "MikroTik",
  category: "Router",
  description: "Dual-band router",
  addedAt: new Date().toISOString(),
  isWatched: true,
  listings: [
    {
      distributorId: "balticnetworks-us",
      productId: "p1",
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com/us",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    },
    {
      distributorId: "server2u-my",
      productId: "p1",
      price: 400,
      currency: "MYR",
      stockStatus: "in_stock",
      url: "https://example.com/my",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    },
  ],
};

function renderProductDetail() {
  render(
    <MemoryRouter initialEntries={["/product/p1"]}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTauriInvoke.mockRejectedValue(new Error("no tauri"));
  localStorage.clear();
  mockStorage.getWatchlist.mockResolvedValue([product]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    shippingRegion: "Asia-Pacific",
  });
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.updateProductListings.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { __TAURI__?: boolean }).__TAURI__;
});

describe("converted row prices", () => {
  it("shows converted equivalents for foreign-currency rows only", async () => {
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getAllByText(formatPrice(400, "MYR")).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(formatPrice(100, "USD")).length).toBeGreaterThan(0);

    const converted = convertPrice(400, "MYR", "USD");
    expect(converted).not.toBeNull();
    expect(screen.getByText(`≈ ${formatPrice(converted as number, "USD")}`)).toBeInTheDocument();

    // Header converter (Task 4) adds its own ≈ line alongside the single row-level one.
    expect(screen.getAllByText(/≈/).length).toBe(2);
  });

  it("renders per-row sparklines that open history", async () => {
    const now = new Date().toISOString();
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "MikroTik hAP ac3",
        modelNumber: "hAP ac3",
        brand: "MikroTik",
        category: "Router",
        description: "Dual-band router",
        addedAt: now,
        isWatched: true,
        listings: [
          {
            distributorId: "balticnetworks-us",
            productId: "p1",
            price: 100,
            currency: "USD",
            stockStatus: "in_stock",
            url: "https://example.com/us",
            lastChecked: now,
            priceHistory: [
              { date: "2026-08-01", price: 110, currency: "USD", stockStatus: "in_stock" },
              { date: "2026-09-01", price: 100, currency: "USD", stockStatus: "in_stock" },
            ],
          },
          {
            distributorId: "server2u-my",
            productId: "p1",
            price: 400,
            currency: "MYR",
            stockStatus: "in_stock",
            url: "https://example.com/my",
            lastChecked: now,
            priceHistory: [],
          },
        ],
      },
    ]);
    renderProductDetail();

    await waitFor(() => {
      expect(
        screen.getAllByRole("img", { name: /price sparkline/i }).length,
      ).toBeGreaterThan(0);
    });

    const historyButtons = screen.getAllByRole("button", {
      name: /view baltic networks price history/i,
    });
    const rowSparkline = historyButtons.find((b) =>
      b.querySelector('svg[role="img"]'),
    );
    expect(rowSparkline).toBeDefined();

    // Empty-history row renders NO sparkline button — only the single
    // history sparkline across rows; the Server2U row falls back to a link.
    const allHistoryButtons = screen.getAllByRole("button", {
      name: /view .* price history/i,
    });
    const sparklineButtons = allHistoryButtons.filter((b) =>
      b.querySelector('svg[role="img"]'),
    );
    expect(sparklineButtons.length).toBe(1);
    expect(
      screen.queryByRole("button", { name: /view server2u price history/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view server2u price history/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /price history/i }),
    ).toBeInTheDocument();

    fireEvent.click(rowSparkline as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Baltic Networks")).toBeInTheDocument();
  });
});

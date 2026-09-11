import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getAllByText(/≈/).length).toBe(1);
  });
});

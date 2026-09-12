import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { formatPrice } from "@shared/currency";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getStockWatches: vi.fn(),
  getAlerts: vi.fn(),
  updateProductListings: vi.fn(),
  addAlert: vi.fn(),
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

function makeProduct(history: { price: number; date: string }[]) {
  const current = history[history.length - 1].price;
  return {
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
        price: current,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com/us",
        lastChecked: new Date().toISOString(),
        priceHistory: history.map((h) => ({
          ...h,
          currency: "USD",
          stockStatus: "in_stock",
        })),
      },
    ],
  };
}

function renderProductDetail() {
  return render(
    <MemoryRouter initialEntries={["/product/p1"]}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

const settings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  shippingRegion: "Asia-Pacific",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTauriInvoke.mockRejectedValue(new Error("no tauri"));
  localStorage.clear();
  mockStorage.getSettings.mockResolvedValue(settings);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.updateProductListings.mockResolvedValue(undefined);
  mockStorage.addAlert.mockResolvedValue(undefined);
});

afterEach(() => {
  delete (window as unknown as { __TAURI__?: boolean }).__TAURI__;
});

describe("best-price signals", () => {
  it("shows trend and lowest-ever signals", async () => {
    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct([
        { price: 100, date: "2026-06-01T00:00:00.000Z" },
        { price: 90, date: "2026-09-01T00:00:00.000Z" },
      ]),
    ]);
    const first = renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText(/▼ 10%/)).toBeInTheDocument();
    });
    expect(screen.getByText("Lowest Price Ever")).toBeInTheDocument();
    first.unmount();

    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct([
        { price: 90, date: "2026-06-01T00:00:00.000Z" },
        { price: 100, date: "2026-09-01T00:00:00.000Z" },
      ]),
    ]);
    const second = renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText(/▲ 11%/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Lowest Price Ever")).not.toBeInTheDocument();
    second.unmount();

    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct([{ price: 100, date: "2026-09-01T00:00:00.000Z" }]),
    ]);
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText("Best Price")).toBeInTheDocument();
    });
    expect(screen.queryByText(/[▼▲] \d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText("Lowest Price Ever")).not.toBeInTheDocument();
  });

  it("creates a −5% alert in one tap", async () => {
    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct([
        { price: 100, date: "2026-06-01T00:00:00.000Z" },
        { price: 90, date: "2026-09-01T00:00:00.000Z" },
      ]),
    ]);
    renderProductDetail();

    const suggested = Math.round(90 * 0.95 * 100) / 100;
    const label = `Set Alert at ${formatPrice(suggested, "USD")} (−5%)`;
    const button = await screen.findByRole("button", { name: label });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockStorage.addAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "p1",
          direction: "drop",
          distributorId: "balticnetworks-us",
          targetPrice: suggested,
          currency: "USD",
          isActive: true,
        }),
      );
    });
    expect(
      await screen.findByText(`Alert set at ${formatPrice(suggested, "USD")}`),
    ).toBeInTheDocument();
  });

  it("creates two distinct alerts on rapid double-tap", async () => {
    mockStorage.getWatchlist.mockResolvedValue([
      makeProduct([
        { price: 100, date: "2026-06-01T00:00:00.000Z" },
        { price: 90, date: "2026-09-01T00:00:00.000Z" },
      ]),
    ]);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1726000000000);
    try {
      renderProductDetail();

      const suggested = Math.round(90 * 0.95 * 100) / 100;
      const label = `Set Alert at ${formatPrice(suggested, "USD")} (−5%)`;
      const button = await screen.findByRole("button", { name: label });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStorage.addAlert).toHaveBeenCalledTimes(2);
      });
      const ids = mockStorage.addAlert.mock.calls.map(
        (c) => (c[0] as { id: string }).id,
      );
      expect(ids[0]).not.toBe(ids[1]);
      for (const alertId of ids) {
        expect(alertId).toMatch(/^alert-1726000000000-[a-z0-9]{6}$/);
      }
    } finally {
      nowSpy.mockRestore();
    }
  });
});

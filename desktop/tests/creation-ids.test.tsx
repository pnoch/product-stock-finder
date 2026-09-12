import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getStockWatches: vi.fn(),
  getAlerts: vi.fn(),
  updateProductListings: vi.fn(),
  addAlert: vi.fn(),
  addBackOrderReminder: vi.fn(),
  addStockWatch: vi.fn(),
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

function makeProduct() {
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
        price: 90,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com/us",
        lastChecked: new Date().toISOString(),
        priceHistory: [
          { price: 100, currency: "USD", date: "2026-06-01T00:00:00.000Z", stockStatus: "in_stock" },
          { price: 90, currency: "USD", date: "2026-09-01T00:00:00.000Z", stockStatus: "in_stock" },
        ],
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
  mockStorage.getWatchlist.mockResolvedValue([makeProduct()]);
  mockStorage.getSettings.mockResolvedValue(settings);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.updateProductListings.mockResolvedValue(undefined);
  mockStorage.addAlert.mockResolvedValue(undefined);
  mockStorage.addBackOrderReminder.mockResolvedValue(undefined);
  mockStorage.addStockWatch.mockResolvedValue(undefined);
});

afterEach(() => {
  delete (window as unknown as { __TAURI__?: boolean }).__TAURI__;
});

describe("creation ids", () => {
  it("mints distinct reminder ids on rapid double-create", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1726000000000);
    try {
      renderProductDetail();

      const dateInput = await screen.findByLabelText("Inline reminder date");
      fireEvent.change(dateInput, { target: { value: "2030-06-01" } });
      const button = screen.getByRole("button", { name: "Remind Me" });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStorage.addBackOrderReminder).toHaveBeenCalledTimes(2);
      });
      const ids = mockStorage.addBackOrderReminder.mock.calls.map(
        (c) => (c[0] as { id: string }).id,
      );
      expect(ids[0]).not.toBe(ids[1]);
      for (const reminderId of ids) {
        expect(reminderId).toMatch(/^reminder-1726000000000-[a-z0-9]{6}$/);
      }
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("mints distinct watch ids on rapid double-create", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1726000000000);
    try {
      renderProductDetail();

      const buttons = await screen.findAllByRole("button", { name: "Watch for restock" });
      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(mockStorage.addStockWatch).toHaveBeenCalledTimes(1);
      });
      fireEvent.click(await screen.findByRole("button", { name: "Watch for restock" }));

      await waitFor(() => {
        expect(mockStorage.addStockWatch).toHaveBeenCalledTimes(2);
      });
      const ids = mockStorage.addStockWatch.mock.calls.map(
        (c) => (c[0] as { id: string }).id,
      );
      expect(ids[0]).not.toBe(ids[1]);
      for (const watchId of ids) {
        expect(watchId).toMatch(/^watch-1726000000000-[a-z0-9]{6}$/);
      }
    } finally {
      nowSpy.mockRestore();
    }
  });
});

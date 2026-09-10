import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

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

const mockInsightsQuery = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    prices: { get: { query: vi.fn().mockResolvedValue(null) } },
    insights: { get: { query: mockInsightsQuery } },
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: () => Promise.reject(new Error("no tauri")),
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
  listings: [],
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

describe("insight loading skeleton", () => {
  it("shows a skeleton while the insight loads, then the card", async () => {
    let resolveInsight!: (v: { insight: string }) => void;
    mockInsightsQuery.mockReturnValue(
      new Promise<{ insight: string }>((resolve) => {
        resolveInsight = resolve;
      }),
    );
    renderProductDetail();

    const skeleton = await screen.findByRole("status", { name: /loading insight/i });
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByText("AI insight")).not.toBeInTheDocument();

    resolveInsight({ insight: "Cheapest at Dist One" });

    await waitFor(() =>
      expect(screen.getByText("Cheapest at Dist One")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("status", { name: /loading insight/i })).not.toBeInTheDocument();
  });
});

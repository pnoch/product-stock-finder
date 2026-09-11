import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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

describe("tauri insight fetch", () => {
  it("times out a hung Tauri insight fetch", async () => {
    vi.useFakeTimers();
    (window as unknown as { __TAURI__?: boolean }).__TAURI__ = true;
    mockTauriInvoke.mockReturnValue(new Promise(() => {}));
    renderProductDetail();

    for (let i = 0; i < 50; i++) {
      if (screen.queryByRole("status", { name: /loading insight/i })) break;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
    }
    expect(screen.getByRole("status", { name: /loading insight/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    expect(screen.queryByRole("status", { name: /loading insight/i })).not.toBeInTheDocument();
    expect(screen.queryByText("AI insight")).not.toBeInTheDocument();
  });

  it("logs Tauri insight fetch failures", async () => {
    (window as unknown as { __TAURI__?: boolean }).__TAURI__ = true;
    mockTauriInvoke.mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderProductDetail();
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          "[ProductDetail] insight fetch failed",
          expect.anything(),
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("status", { name: /loading insight/i }),
        ).not.toBeInTheDocument(),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { DistributorHistoryModal } from "../src/components/DistributorHistoryModal";

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

const listing = {
  distributorId: "d1",
  productId: "p1",
  price: 90,
  currency: "USD",
  stockStatus: "in_stock",
  url: "https://example.com/p1",
  lastChecked: "2026-09-01",
  priceHistory: [
    { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
    { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
  ],
};

describe("distributor history modal", () => {
  it("renders the listing chart and downloads CSV", async () => {
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        writable: true,
        value: vi.fn(() => "blob:mock"),
      });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", {
        writable: true,
        value: vi.fn(),
      });
    }
    const clicked: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    try {
      render(
        <MemoryRouter>
          <DistributorHistoryModal
            open
            onClose={() => {}}
            productId="p1"
            productName="Widget"
            listing={listing as never}
            distributorName="Dist One"
            displayCurrency="USD"
          />
        </MemoryRouter>,
      );
      expect(screen.getByText(/dist one/i)).toBeInTheDocument();
      expect(document.querySelector("svg.recharts-surface")).not.toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /download csv/i }));
      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(clicked.length).toBeGreaterThan(0);
      expect(clicked[0].download).toContain("p1-d1-history.csv");
      expect(clicked[0].href).toContain("blob:mock");
    } finally {
      clickSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });

  it("links to the full comparison for the distributor", () => {
    render(
      <MemoryRouter>
        <DistributorHistoryModal
          open
          onClose={() => {}}
          productId="p1"
          productName="Widget"
          listing={listing as never}
          distributorName="Dist One"
          displayCurrency="USD"
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /full comparison/i });
    expect(link.getAttribute("href")).toBe("/compare/p1?distributor=d1");
  });

  it("opens the modal from a listing row with >=2 points", async () => {
    const wiredProduct = {
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
          lastChecked: new Date().toISOString(),
          priceHistory: [],
        },
      ],
    };
    vi.clearAllMocks();
    mockTauriInvoke.mockRejectedValue(new Error("no tauri"));
    localStorage.clear();
    mockStorage.getWatchlist.mockResolvedValue([wiredProduct]);
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

    render(
      <MemoryRouter initialEntries={["/product/p1"]}>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const historyButtons = await screen.findAllByRole("button", {
      name: /view baltic networks price history/i,
    });
    const historyButton = historyButtons.find(
      (b) => !b.querySelector('svg[role="img"]'),
    ) as HTMLElement;
    expect(historyButton).toBeDefined();
    expect(
      screen.queryByRole("link", { name: /view baltic networks price history/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(historyButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Baltic Networks")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /download csv/i }),
    ).toBeInTheDocument();
  });
});

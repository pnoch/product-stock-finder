import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getStockWatches: vi.fn(),
  getAlerts: vi.fn(),
  getDiscoveredProducts: vi.fn(),
  updateProductListings: vi.fn(),
  addToWatchlist: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

vi.mock("../src/lib/api-base", () => ({
  getApiBaseUrl: () => "",
  getOAuthPortalUrl: () => "",
  getAppId: () => "",
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));

import { Search } from "../src/pages/Search";
import { ProductDetail } from "../src/pages/ProductDetail";

beforeEach(() => {
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getDiscoveredProducts.mockResolvedValue([]);
  mockStorage.addToWatchlist.mockResolvedValue(true);
});

describe("desktop search-result preview parity", () => {
  it("opens a catalog result from the search row", async () => {
    render(
      <MemoryRouter initialEntries={["/search"]}>
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<div>PRODUCT PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "CRS804" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Open MikroTik CRS804-4DDQ-hRM" }),
    );
    await waitFor(() => {
      expect(screen.getByText("PRODUCT PAGE")).toBeInTheDocument();
    });
  });

  it("previews an untracked catalog product with an Add to Watchlist CTA", async () => {
    render(
      <MemoryRouter initialEntries={["/product/mikrotik-crs804-4ddq-hrm"]}>
        <Routes>
          <Route path="/product/:id" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("button", { name: "Add to watchlist" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/isn't in your watchlist yet/)).toBeInTheDocument();
  });
});

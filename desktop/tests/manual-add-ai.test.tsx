import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getDiscoveredProducts: vi.fn(),
  addToWatchlist: vi.fn(),
  updateProductListings: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

const mockDiscoverProduct = vi.hoisted(() => vi.fn());
const mockDiscoverListings = vi.hoisted(() => vi.fn());

vi.mock("../../lib/llm-discovery", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/llm-discovery")>();
  return { ...mod, discoverProduct: mockDiscoverProduct };
});

vi.mock("../../lib/listing-discovery", () => ({
  discoverListings: mockDiscoverListings,
}));

import { Search } from "../src/pages/Search";
import { DiscoveryAuthError, DiscoveryError } from "../../lib/llm-discovery";

function renderSearch() {
  return render(
    <MemoryRouter>
      <Search />
    </MemoryRouter>,
  );
}

function openManualModal() {
  fireEvent.click(screen.getByRole("button", { name: "Manual Add" }));
}

const discoveredProduct = {
  id: "disc-1",
  name: "CRS326 Switch",
  modelNumber: "CRS326-24G",
  brand: "MikroTik",
  category: "Switch",
  description: "",
  addedAt: new Date().toISOString(),
  isWatched: true,
  listings: [],
};

const listingA = {
  distributorId: "dist-a",
  productId: "manual-1",
  price: 100,
  currency: "USD",
  stockStatus: "in_stock",
  url: "https://example.com/a",
  lastChecked: new Date().toISOString(),
  priceHistory: [],
};

const listingB = {
  distributorId: "dist-b",
  productId: "manual-1",
  price: 110,
  currency: "USD",
  stockStatus: "in_stock",
  url: "https://example.com/b",
  lastChecked: new Date().toISOString(),
  priceHistory: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getDiscoveredProducts.mockResolvedValue([]);
  mockStorage.addToWatchlist.mockResolvedValue(undefined);
  mockStorage.updateProductListings.mockResolvedValue(undefined);
  mockDiscoverProduct.mockResolvedValue(null);
  mockDiscoverListings.mockResolvedValue([]);
});

describe("manual add AI assist", () => {
  it("parses pasted text then discovers listings", async () => {
    mockDiscoverProduct.mockResolvedValue({ product: discoveredProduct, retailers: [] });
    const progressCalls: [number, number][] = [];
    mockDiscoverListings.mockImplementation(async (_model: string, opts?: { onProgress?: (done: number, total: number) => void; productId?: string }) => {
      opts?.onProgress?.(1, 2);
      opts?.onProgress?.(2, 2);
      progressCalls.push([1, 2], [2, 2]);
      return [listingA, listingB];
    });

    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByLabelText("Paste product text"), {
      target: { value: "MikroTik CRS326-24G switch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse with AI" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Product name *")).toHaveValue("CRS326 Switch");
    });
    expect(screen.getByPlaceholderText("Model number *")).toHaveValue("CRS326-24G");
    expect(screen.getByPlaceholderText("Brand")).toHaveValue("MikroTik");
    expect(screen.getByPlaceholderText("Category")).toHaveValue("Switch");

    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ modelNumber: "CRS326-24G", listings: [] }),
      );
    });
    await waitFor(() => {
      expect(mockDiscoverListings).toHaveBeenCalledWith(
        "CRS326-24G",
        expect.objectContaining({ productId: expect.stringMatching(/^manual-/) }),
      );
    });
    await waitFor(() => {
      expect(mockStorage.updateProductListings).toHaveBeenCalledWith(
        expect.stringMatching(/^manual-/),
        [listingA, listingB],
      );
    });
    expect(progressCalls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(await screen.findByText("Added CRS326 Switch")).toBeInTheDocument();
  });

  it("falls back to the plain form on parse failure", async () => {
    mockDiscoverProduct.mockRejectedValue(new DiscoveryError("server", "boom", { status: 500 }));

    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByLabelText("Paste product text"), {
      target: { value: "some obscure gadget" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse with AI" }));

    expect(await screen.findByText("Discovery Failed")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "Plain Widget" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "PW-100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Plain Widget", modelNumber: "PW-100", listings: [] }),
      );
    });
    expect(mockStorage.updateProductListings).not.toHaveBeenCalled();
    expect(await screen.findByText("Added Plain Widget")).toBeInTheDocument();
  });

  it("shows auth guidance on DiscoveryAuthError", async () => {
    mockDiscoverProduct.mockRejectedValue(new DiscoveryAuthError(401));

    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByLabelText("Paste product text"), {
      target: { value: "CRS326" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse with AI" }));

    expect(await screen.findByText("Sign-in Required")).toBeInTheDocument();
  });
});

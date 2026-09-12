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

vi.mock("../../lib/listing-discovery", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/listing-discovery")>();
  return { ...mod, discoverListings: mockDiscoverListings };
});

import { Search } from "../src/pages/Search";
import { DiscoveryAuthError, DiscoveryError } from "../../lib/llm-discovery";
import { customProductSlug } from "../../lib/listing-discovery";

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
    expect(
      await screen.findByText(
        "Added Plain Widget with no listings — discovery found nothing",
      ),
    ).toBeInTheDocument();
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

  it("says when discovery found nothing", async () => {
    mockDiscoverListings.mockResolvedValue([]);

    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "Lonely Gadget" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "LG-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    expect(
      await screen.findByText(
        "Added Lonely Gadget with no listings — discovery found nothing",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Lonely Gadget", modelNumber: "LG-1" }),
      );
    });
    expect(
      screen.queryByRole("button", { name: "Add manual product" }),
    ).not.toBeInTheDocument();
  });

  it("fetches from a distributor URL", async () => {
    mockDiscoverProduct.mockResolvedValue({ product: discoveredProduct, retailers: [] });

    renderSearch();
    openManualModal();

    const urlInput = screen.getByLabelText("Distributor URL");
    const fetchButton = screen.getByRole("button", { name: "Fetch from URL" });
    expect(fetchButton).toBeDisabled();

    fireEvent.change(urlInput, { target: { value: "not a url" } });
    expect(screen.getByRole("button", { name: "Fetch from URL" })).toBeDisabled();

    fireEvent.change(urlInput, { target: { value: "https://example.com/product/crs326" } });
    expect(screen.getByRole("button", { name: "Fetch from URL" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Fetch from URL" }));

    await waitFor(() => {
      expect(mockDiscoverProduct).toHaveBeenCalledWith("https://example.com/product/crs326");
    });
    expect(await screen.findByDisplayValue("CRS326 Switch")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Model number *")).toHaveValue("CRS326-24G");
  });

  it("carries the description into the created product", async () => {
    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "Described Gadget" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "DG-9" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "A very useful gadget" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ description: "A very useful gadget" }),
      );
    });
  });

  it("blocks duplicate models with Already Tracked", async () => {
    const dupSlug = customProductSlug("CRS326-24G");
    mockStorage.getWatchlist.mockResolvedValue([{ id: dupSlug } as never]);

    renderSearch();
    openManualModal();

    await waitFor(() => {
      expect(mockStorage.getWatchlist).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "CRS326 Switch" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "CRS326-24G" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    expect(
      await screen.findByText("Already Tracked — that model number is already in your watchlist."),
    ).toBeInTheDocument();
    expect(mockStorage.addToWatchlist).not.toHaveBeenCalled();
  });
});

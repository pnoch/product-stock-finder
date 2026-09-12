import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DISCOVER_TIMEOUT_MS } from "../../lib/manual-add";

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
import { SearchModal } from "../src/components/SearchModal";
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
  vi.useRealTimers();
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
        expect.objectContaining({ productId: customProductSlug("CRS326-24G") }),
      );
    });
    await waitFor(() => {
      expect(mockStorage.updateProductListings).toHaveBeenCalledWith(
        customProductSlug("CRS326-24G"),
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

  it("mints the slug as the product id", async () => {
    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "CRS326 Switch" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "CRS326-24G" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    const slug = customProductSlug("CRS326-24G");
    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ id: slug, modelNumber: "CRS326-24G" }),
      );
    });
    expect(mockDiscoverListings).toHaveBeenCalledWith(
      "CRS326-24G",
      expect.objectContaining({ productId: slug }),
    );
    expect(mockStorage.updateProductListings).not.toHaveBeenCalled();
  });

  it("blocks a duplicate across adds in the same session", async () => {
    renderSearch();
    openManualModal();

    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "CRS326 Switch" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "CRS326-24G" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Added CRS326 Switch with no listings — discovery found nothing"),
    ).toBeInTheDocument();

    openManualModal();
    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "CRS326 Switch Again" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "CRS326-24G" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    expect(
      await screen.findByText("Already Tracked — that model number is already in your watchlist."),
    ).toBeInTheDocument();
    expect(mockStorage.addToWatchlist).toHaveBeenCalledTimes(1);
  });

  it("times out hung discovery, keeps the product, and stays open with Retry", async () => {
    vi.useFakeTimers();
    try {
      mockDiscoverListings.mockImplementation(() => new Promise<never>(() => {}));
      renderSearch();
      openManualModal();

      fireEvent.change(screen.getByPlaceholderText("Product name *"), {
        target: { value: "Hung Gadget" },
      });
      fireEvent.change(screen.getByPlaceholderText("Model number *"), {
        target: { value: "HG-1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
      });
    } finally {
      vi.useRealTimers();
    }

    const slug = customProductSlug("HG-1");
    expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
      expect.objectContaining({ id: slug, listings: [] }),
    );
    expect(mockStorage.updateProductListings).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Added Hung Gadget with no listings — discovery found nothing"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add manual product" })).not.toBeDisabled();
    expect(screen.getByPlaceholderText("Product name *")).toBeInTheDocument();
  });

  it("retries discovery after timeout without duplicating", async () => {
    vi.useFakeTimers();
    try {
      mockDiscoverListings.mockImplementation(() => new Promise<never>(() => {}));
      renderSearch();
      openManualModal();

      fireEvent.change(screen.getByPlaceholderText("Product name *"), {
        target: { value: "Retry Gadget" },
      });
      fireEvent.change(screen.getByPlaceholderText("Model number *"), {
        target: { value: "RG-2" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(await screen.findByRole("button", { name: "Retry discovery" })).toBeInTheDocument();
    mockDiscoverListings.mockResolvedValue([listingA, listingB]);
    fireEvent.click(screen.getByRole("button", { name: "Retry discovery" }));

    const slug = customProductSlug("RG-2");
    await waitFor(() => {
      expect(mockStorage.updateProductListings).toHaveBeenCalledWith(slug, [listingA, listingB]);
    });
    expect(mockStorage.addToWatchlist).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add manual product" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Added Retry Gadget")).toBeInTheDocument();
  });
});

describe("SearchModal manual add discovery parity", () => {
  function renderModal() {
    return render(
      <MemoryRouter>
        <SearchModal open onClose={() => {}} />
      </MemoryRouter>,
    );
  }

  function openModalManualSheet() {
    fireEvent.click(screen.getByRole("button", { name: "Manual add" }));
  }

  function fillModalManualForm() {
    fireEvent.change(screen.getByPlaceholderText("Product name *"), {
      target: { value: "Modal Gadget" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model number *"), {
      target: { value: "MG-7" },
    });
  }

  it("discovers listings post-add and persists them", async () => {
    mockDiscoverListings.mockResolvedValue([listingA, listingB]);
    const slug = customProductSlug("MG-7");

    renderModal();
    openModalManualSheet();
    fillModalManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ id: slug, modelNumber: "MG-7", listings: [] }),
      );
    });
    await waitFor(() => {
      expect(mockDiscoverListings).toHaveBeenCalledWith(
        "MG-7",
        expect.objectContaining({ productId: slug }),
      );
    });
    await waitFor(() => {
      expect(mockStorage.updateProductListings).toHaveBeenCalledWith(slug, [
        listingA,
        listingB,
      ]);
    });
    expect(await screen.findByText("Added Modal Gadget")).toBeInTheDocument();
  });

  it("carries the description into the created product", async () => {
    renderModal();
    openModalManualSheet();
    fillModalManualForm();
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

  it("keeps the product when discovery fails", async () => {
    mockDiscoverListings.mockRejectedValue(new Error("network down"));

    renderModal();
    openModalManualSheet();
    fillModalManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

    await waitFor(() => {
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ modelNumber: "MG-7" }),
      );
    });
    await waitFor(() => {
      expect(mockDiscoverListings).toHaveBeenCalledWith(
        "MG-7",
        expect.objectContaining({ productId: customProductSlug("MG-7") }),
      );
    });
    expect(mockStorage.updateProductListings).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Added Modal Gadget with no listings — discovery found nothing",
      ),
    ).toBeInTheDocument();
  });

  it("times out hung discovery and stays open with Retry", async () => {
    vi.useFakeTimers();
    try {
      mockDiscoverListings.mockImplementation(() => new Promise<never>(() => {}));
      renderModal();
      openModalManualSheet();
      fillModalManualForm();
      fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
      });
    } finally {
      vi.useRealTimers();
    }

    const slug = customProductSlug("MG-7");
    expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
      expect.objectContaining({ id: slug, listings: [] }),
    );
    expect(mockStorage.updateProductListings).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Added Modal Gadget with no listings — discovery found nothing",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry discovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add manual product" })).not.toBeDisabled();
  });

  it("retries discovery after timeout without duplicating", async () => {
    vi.useFakeTimers();
    try {
      mockDiscoverListings.mockImplementation(() => new Promise<never>(() => {}));
      renderModal();
      openModalManualSheet();
      fillModalManualForm();
      fireEvent.click(screen.getByRole("button", { name: "Add manual product" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVER_TIMEOUT_MS + 100);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(await screen.findByRole("button", { name: "Retry discovery" })).toBeInTheDocument();
    mockDiscoverListings.mockResolvedValue([listingA, listingB]);
    fireEvent.click(screen.getByRole("button", { name: "Retry discovery" }));

    const slug = customProductSlug("MG-7");
    await waitFor(() => {
      expect(mockStorage.updateProductListings).toHaveBeenCalledWith(slug, [listingA, listingB]);
    });
    expect(mockStorage.addToWatchlist).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add manual product" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Added Modal Gadget")).toBeInTheDocument();
  });
});

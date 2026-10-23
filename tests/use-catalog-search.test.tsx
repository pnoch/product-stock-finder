// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_CATALOG } from "@shared/catalog";

const state = vi.hoisted(() => ({
  watchlist: [] as { id: string }[],
  discovered: [] as unknown[],
  settings: {} as Record<string, unknown>,
  added: [] as unknown[],
  tags: {} as Record<string, unknown>,
  createdTag: { id: "tag-new", name: "New", color: "#fff" },
}));

vi.mock("../desktop/src/hooks/use-bulk-import", () => ({
  useBulkImport: () => ({
    bulkOpen: false,
    setBulkOpen: vi.fn(),
    bulkText: "",
    setBulkText: vi.fn(),
    bulkImporting: false,
    bulkPreview: { matched: [], unmatched: [] },
    bulkNew: [],
    handleBulkImport: vi.fn(),
  }),
}));

vi.mock("../desktop/src/hooks/use-manual-add", () => ({
  useManualAdd: () => ({
    manualOpen: false,
    manualName: "",
    setManualName: vi.fn(),
    manualModel: "",
    setManualModel: vi.fn(),
    manualBrand: "",
    setManualBrand: vi.fn(),
    manualCategory: "",
    setManualCategory: vi.fn(),
    manualDescription: "",
    setManualDescription: vi.fn(),
    pasteText: "",
    setPasteText: vi.fn(),
    urlInput: "",
    setUrlInput: vi.fn(),
    urlParsing: false,
    manualParsing: false,
    manualDiscovering: false,
    manualProgress: null,
    manualTimedOut: null,
    manualRetrying: false,
    manualError: null,
    handleManualParse: vi.fn(),
    handleUrlFetch: vi.fn(),
    handleManualAdd: vi.fn(),
    handleManualRetry: vi.fn(),
    openManual: vi.fn(),
    closeManualModal: vi.fn(),
  }),
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    getWatchlist: vi.fn(async () => state.watchlist),
    getDiscoveredProducts: vi.fn(async () => state.discovered),
    getSettings: vi.fn(async () => state.settings),
    addToWatchlist: vi.fn(async (product: unknown) => {
      state.added.push(product);
      return true;
    }),
    getTagDefinitions: vi.fn(async () => state.tags),
    createTag: vi.fn(async () => state.createdTag),
  },
}));

vi.mock("../lib/llm-discovery", () => ({
  discoverProduct: vi.fn(),
  toDiscoverErrorState: vi.fn(() => ({
    title: "Discovery failed",
    message: "try again",
    retry: true,
  })),
}));

vi.mock("../desktop/src/components/search-chrome", async () => {
  const actual = await vi.importActual<
    typeof import("../desktop/src/components/search-chrome")
  >("../desktop/src/components/search-chrome");
  return {
    ...actual,
    loadRecent: () => [],
    recordRecent: (query: string) => [query],
  };
});

import { discoverProduct } from "../lib/llm-discovery";
import { useCatalogSearch } from "../desktop/src/hooks/use-catalog-search";

const product = PRODUCT_CATALOG[0]!;

describe("useCatalogSearch", () => {
  beforeEach(() => {
    state.watchlist = [];
    state.discovered = [];
    state.settings = {};
    state.added = [];
    state.tags = {};
    vi.mocked(discoverProduct).mockReset();
  });

  it("loads tracked ids and discovered products", async () => {
    state.watchlist = [{ id: product.id }];
    const { result } = renderHook(() => useCatalogSearch());
    await waitFor(() => expect(result.current.trackedIds.has(product.id)).toBe(true));
  });

  it("adds a product, updates tracked ids, and calls onAdded", async () => {
    const onAdded = vi.fn();
    const { result } = renderHook(() => useCatalogSearch({ onAdded }));
    await waitFor(() => expect(result.current.trackedIds.size).toBe(0));

    await act(async () => {
      await result.current.handleAdd(product);
    });

    expect(state.added).toHaveLength(1);
    expect(result.current.trackedIds.has(product.id)).toBe(true);
    expect(onAdded).toHaveBeenCalledWith(product);
  });

  it("adds a discovered product and calls onDiscovered", async () => {
    const onDiscovered = vi.fn();
    vi.mocked(discoverProduct).mockResolvedValue({
      product: {
        id: "discovered-1",
        name: "Discovered",
        modelNumber: "D-1",
        brand: "Brand",
        category: "Router",
        description: "",
      },
    } as never);
    const { result } = renderHook(() => useCatalogSearch({ onDiscovered }));
    await waitFor(() => expect(result.current.trackedIds.size).toBe(0));

    act(() => result.current.setQuery("discovered"));
    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(state.added).toHaveLength(1);
    expect(result.current.trackedIds.has("discovered-1")).toBe(true);
    expect(onDiscovered).toHaveBeenCalledWith("discovered-1");
  });

  it("toggles pending tags for the selected product", async () => {
    const { result } = renderHook(() => useCatalogSearch());
    await waitFor(() => expect(result.current.trackedIds.size).toBe(0));

    act(() => result.current.setTagPickerFor(product.id));
    act(() => result.current.toggleTag("tag-1"));
    expect(result.current.pendingTags[product.id]).toEqual(["tag-1"]);

    act(() => result.current.toggleTag("tag-1"));
    expect(result.current.pendingTags[product.id]).toEqual([]);
  });
});

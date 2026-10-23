import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import { Search, Upload, PenLine } from "lucide-react";
import { PRODUCT_CATALOG, getAllCategories, getAllBrands, SEARCH_OPTIONS, sortCatalogByPrice } from "@shared/catalog";
import Fuse from "fuse.js";
import { storage } from "../storage";
import { Modal } from "./Modal";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { discoverListings, customProductSlug } from "../../../lib/listing-discovery";
import { manualAddProduct, rediscoverProduct } from "../../../lib/manual-add";
import { useToast } from "../hooks/use-toast";
import { matchModels, parseModelInput } from "../../../lib/bulk-import";
import { runDiscoveryLoop } from "../../../lib/bulk-discovery";
import { nextTagColor } from "../../../lib/tags";
import type { TagDefinition, DistributorListing } from "../../../lib/types";

import { RECENT_KEY, loadRecent, recordRecent, type CatalogSort, CATALOG_SORT_OPTIONS, PillFilterRow } from "./search-chrome";
import { TagPickerDialog } from "./search/TagPickerDialog";
import { BulkImportDialog } from "./search/BulkImportDialog";
import { SearchModalResults } from "./search/SearchModalResults";
import { SearchModalManualAddDialog } from "./search/SearchModalManualAddDialog";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<{ title: string; message: string; retry: boolean } | null>(null);
  const { toast, showToast } = useToast();
  const [discoveredProducts, setDiscoveredProducts] = useState<typeof PRODUCT_CATALOG>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDiscovering, setManualDiscovering] = useState(false);
  const [manualProgress, setManualProgress] = useState<string | null>(null);
  const [manualTimedOut, setManualTimedOut] = useState<{ id: string; name: string; modelNumber: string } | null>(null);
  const [manualRetrying, setManualRetrying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset only on the closed→open transition. Running on every `open` render
  // (or after an unrelated re-render) could clear a query the user had already
  // typed, which also made the discovery tests flaky.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (justOpened) {
      setQuery("");
      setDiscoverError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
      storage.getWatchlist().then((products) => setTrackedIds(new Set(products.map((p) => p.id)))).catch(() => {});
      storage.getDiscoveredProducts().then((disc) => {
        // Convert Product[] to catalog shape; limit to 50
        let list = disc.map((p) => ({ id: p.id, name: p.name, modelNumber: p.modelNumber, brand: p.brand, category: p.category, description: p.description ?? "" }));
        if (list.length > 50) list = list.slice(-50);
        setDiscoveredProducts(list as typeof PRODUCT_CATALOG);
      }).catch(() => {});
      setRecentSearches(loadRecent());
      storage.getSettings().then((s) => setTagDefinitions((s.tagDefinitions ?? {}) as Record<string, TagDefinition>)).catch(() => {});
    }
  }, [open]);

  const combinedCatalog = useMemo(() => {
    if (discoveredProducts.length === 0) return PRODUCT_CATALOG;
    const staticIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
    const filtered = discoveredProducts.filter((p) => !staticIds.has(p.id));
    return [...PRODUCT_CATALOG, ...filtered] as typeof PRODUCT_CATALOG;
  }, [discoveredProducts]);

  const fuse = useMemo(() => new Fuse(combinedCatalog, SEARCH_OPTIONS), [combinedCatalog]);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => {
    if (!deferredQuery.trim()) return combinedCatalog;
    return fuse.search(deferredQuery).map((r) => r.item);
  }, [deferredQuery, fuse, combinedCatalog]);

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  const categoryBrandFiltered = useMemo(() => {
    let out = results;
    if (selectedCategory) out = out.filter((p) => p.category === selectedCategory);
    if (selectedBrand) out = out.filter((p) => p.brand === selectedBrand);
    return out;
  }, [results, selectedCategory, selectedBrand]);

  const sortedResults = useMemo(() => {
    if (catalogSort === "relevance") return categoryBrandFiltered;
    const copy = [...categoryBrandFiltered];
    switch (catalogSort) {
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "brand":
        return copy.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
      case "price":
        return sortCatalogByPrice(copy);
      default:
        return copy;
    }
  }, [categoryBrandFiltered, catalogSort]);

  const handleAdd = useCallback(async (product: (typeof PRODUCT_CATALOG)[number]) => {
    try {
      const tags = pendingTags[product.id] ?? [];
      await storage.addToWatchlist({
        ...product,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
        tags,
      });
      if (tags.length) {
        setPendingTags((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
      }
      setTrackedIds((prev) => new Set([...prev, product.id]));
      if (tags.length) setTagPickerFor(null);
      showToast(`Added ${product.name}`);
      if (query.trim()) setRecentSearches(recordRecent(query));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add to watchlist";
      showToast(msg);
    }
  }, [pendingTags, query, showToast]);

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const result = await discoverProduct(query, storage);
      if (result) {
        await storage.addToWatchlist({
          ...result.product,
          addedAt: new Date().toISOString(),
          isWatched: true,
          listings: [],
        });
        setTrackedIds((prev) => new Set([...prev, result.product.id]));
        setRecentSearches(recordRecent(query));
        onClose();
      } else {
        showToast("Discovery failed — try a more specific search");
      }
    } catch (e) {
      const errState = toDiscoverErrorState(e);
      setDiscoverError(errState);
      showToast(errState.title);
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, onClose, showToast]);

  const bulkPreview = useMemo(() => matchModels(parseModelInput(bulkText)), [bulkText]);
  const bulkNew = useMemo(() => bulkPreview.matched.filter((p) => !trackedIds.has(p.id)), [bulkPreview, trackedIds]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !tagPickerFor) return;
    try {
      const current = await storage.getTagDefinitions();
      const tag = await storage.createTag(name, nextTagColor(current));
      setTagDefinitions({ ...current, [tag.id]: tag });
      setPendingTags((prev) => ({
        ...prev,
        [tagPickerFor]: [...(prev[tagPickerFor] ?? []), tag.id],
      }));
      setNewTagName("");
    } catch {
      showToast("Couldn't create tag");
    }
  }, [newTagName, tagPickerFor, showToast]);

  const handleBulkImport = async () => {
    if (bulkImporting || bulkNew.length === 0) return;
    setBulkImporting(true);
    try {
      // allSettled so one storage rejection doesn't abort the rest of the
      // import (mobile does the same); only count the writes that landed.
      const results = await Promise.allSettled(
        bulkNew.map((item) => storage.addToWatchlist({ ...item, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] })),
      );
      // Only writes that landed: addToWatchlist resolves false for a
      // duplicate, which the fulfilled-status check used to count as an import.
      const added = bulkNew.filter(
        (_, i) =>
          results[i]!.status === "fulfilled" &&
          (results[i] as PromiseFulfilledResult<boolean>).value === true,
      );
      setTrackedIds((prev) => new Set([...prev, ...added.map((p) => p.id)]));
      setBulkText("");
      setBulkOpen(false);
      const failed = bulkNew.length - added.length;
      // Settle the import UI before the (slow) discovery loop so the dialog is
      // not frozen on "Importing…" with no feedback while batches run.
      setBulkImporting(false);
      let discovered = 0;
      if (added.length > 0) {
        const items = added.map((p) => ({ productId: p.id, modelNumber: p.modelNumber }));
        const rediscoverStorage = {
          updateProductListings: (pid: string, listings: DistributorListing[]) =>
            storage.updateProductListings(pid, listings),
        };
        const loop = await runDiscoveryLoop({
          items,
          storage: rediscoverStorage,
          discover: discoverListings,
          confirmContinue: (remaining) =>
            window.confirm(`Fetch prices for the remaining ${remaining} product${remaining === 1 ? "" : "s"}?`),
        });
        discovered = loop.discovered;
      }
      const discoveryNote = discovered > 0 ? ` · ${discovered} listing${discovered === 1 ? "" : "s"} found` : "";
      showToast(
        failed > 0
          ? `Imported ${added.length} · ${failed} failed${discoveryNote}`
          : `Imported ${added.length}${discoveryNote}`,
      );
    } finally { setBulkImporting(false); }
  };

  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualModel.trim()) {
      showToast("Name and model required");
      return;
    }
    const slug = customProductSlug(manualModel.trim());
    if (trackedIds.has(slug)) {
      showToast("Already Tracked — that model number is already in your watchlist.");
      return;
    }
    if (manualDiscovering) return;
    const id = slug;
    const product = { id, name: manualName.trim(), modelNumber: manualModel.trim(), brand: manualBrand.trim() || "Unknown", category: manualCategory.trim() || categories[0] || "Other", description: manualDescription.trim() };
    const resetManualForm = () => {
      setManualOpen(false);
      setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory(""); setManualDescription("");
      setManualProgress(null); setManualTimedOut(null);
    };
    let created = false;
    setManualDiscovering(true);
    try {
      const result = await manualAddProduct({
        storage: {
          addToWatchlist: async (p) => { const r = await storage.addToWatchlist(p); created = true; return r; },
          updateProductListings: (pid, listings) => storage.updateProductListings(pid, listings),
        },
        trackedIds,
        discover: discoverListings,
        input: { ...product, tags: [] },
        onProgress: (done, total) => setManualProgress(`Discovering ${done}/${total}…`),
      });
      if (result.status === "duplicate") {
        showToast("Already Tracked — that model number is already in your watchlist.");
        return;
      }
      setTrackedIds((prev) => new Set([...prev, id]));
      if (result.timedOut) {
        setManualTimedOut({ id, name: product.name, modelNumber: product.modelNumber });
        showToast(`Added ${product.name} with no listings — discovery found nothing`);
        return;
      }
      resetManualForm();
      showToast(result.discovered > 0 ? `Added ${product.name}` : `Added ${product.name} with no listings — discovery found nothing`);
    } catch (e) {
      if (created) {
        // Best-effort: keep the product with no listings (today's behavior).
        setTrackedIds((prev) => new Set([...prev, id]));
        resetManualForm();
        showToast(`Added ${product.name} with no listings — discovery found nothing`);
      } else {
        showToast(e instanceof Error ? e.message : "Failed to add");
      }
    } finally {
      setManualDiscovering(false);
      setManualProgress(null);
    }
  };
  const handleManualRetry = async () => {
    if (!manualTimedOut || manualRetrying) return;
    const { id, name, modelNumber } = manualTimedOut;
    setManualRetrying(true);
    try {
      const res = await rediscoverProduct({
        storage: { updateProductListings: (pid, listings) => storage.updateProductListings(pid, listings) },
        discover: discoverListings,
        productId: id,
        modelNumber,
        onProgress: (done, total) => setManualProgress(`Discovering ${done}/${total}…`),
      });
      if (res.timedOut) {
        showToast(`Added ${name} with no listings — discovery found nothing`);
      } else {
        setManualTimedOut(null);
        setManualOpen(false);
        setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory(""); setManualDescription("");
        setManualProgress(null);
        showToast(res.discovered > 0 ? `Added ${name}` : `Added ${name} with no listings — discovery found nothing`);
      }
    } catch {
      showToast("Discovery failed — try again");
    } finally {
      setManualRetrying(false);
      setManualProgress(null);
    }
  };
  const openManualSheet = () => { setManualTimedOut(null); setManualOpen(true); };
  const closeManualSheet = () => { setManualTimedOut(null); setManualOpen(false); };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Search Products">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Bulk import">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={openManualSheet} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Manual add">
            <PenLine className="w-4 h-4" /> Manual Add
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) setRecentSearches(recordRecent(query)); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            placeholder="Search by name, model, or brand..."
            aria-label="Search products by name, model, or brand"
          />
        </div>
        {query.length === 0 && recentSearches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <span className="text-xs text-gray-500">Recent:</span>
            {recentSearches.map((q) => (
              <button key={q} onClick={() => setQuery(q)} className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>
            ))}
            <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear</button>
          </div>
        )}
        {discoveredProducts.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{discoveredProducts.length} discovered products included · up to 50</p>
        )}
        <div className="flex flex-col gap-2 mb-3">
          <PillFilterRow label="Category" options={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
          <PillFilterRow label="Brand" options={brands} selected={selectedBrand} onSelect={setSelectedBrand} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Sort</span>
            {CATALOG_SORT_OPTIONS.map((opt) => {
              const active = catalogSort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setCatalogSort(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  aria-label={`Sort by ${opt.label}`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
            {(selectedCategory || selectedBrand) && (
              <button onClick={() => { setSelectedCategory(null); setSelectedBrand(null); }} className="text-xs text-gray-500 ml-1">Clear</button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2">{sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}</div>
        <SearchModalResults
          results={sortedResults}
          trackedIds={trackedIds}
          pendingTags={pendingTags}
          tagDefinitions={tagDefinitions}
          query={query}
          discovering={discovering}
          discoverError={discoverError}
          onAssignTags={setTagPickerFor}
          onAdd={(product) => void handleAdd(product as (typeof PRODUCT_CATALOG)[number])}
          onDiscover={() => void handleDiscover()}
        />
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium shadow-lg" role="alert">
            {toast}
          </div>
        )}
      </Modal>

      <TagPickerDialog
        open={tagPickerFor !== null}
        productId={tagPickerFor}
        tagDefinitions={tagDefinitions}
        pendingTags={pendingTags}
        newTagName={newTagName}
        onNewTagName={setNewTagName}
        onToggleTag={(tagId) => {
          if (!tagPickerFor) return;
          setPendingTags((prev) => {
            const cur = prev[tagPickerFor] ?? [];
            const next = cur.includes(tagId)
              ? cur.filter((id) => id !== tagId)
              : [...cur, tagId];
            return { ...prev, [tagPickerFor]: next };
          });
        }}
        onCreateTag={() => void handleCreateTag()}
        onClear={() => {
          if (!tagPickerFor) return;
          setPendingTags((prev) => {
            const n = { ...prev };
            delete n[tagPickerFor];
            return n;
          });
          setTagPickerFor(null);
        }}
        onClose={() => setTagPickerFor(null)}
      />

      <BulkImportDialog
        open={bulkOpen}
        text={bulkText}
        onTextChange={setBulkText}
        matchedCount={bulkPreview.matched.length}
        unmatched={bulkPreview.unmatched}
        newCount={bulkNew.length}
        importing={bulkImporting}
        onImport={handleBulkImport}
        onClose={() => setBulkOpen(false)}
      />

      <SearchModalManualAddDialog
        open={manualOpen}
        onClose={closeManualSheet}
        manualTimedOut={manualTimedOut}
        manualRetrying={manualRetrying}
        manualProgress={manualProgress}
        manualName={manualName}
        onManualName={setManualName}
        manualModel={manualModel}
        onManualModel={setManualModel}
        manualBrand={manualBrand}
        onManualBrand={setManualBrand}
        manualCategory={manualCategory}
        onManualCategory={setManualCategory}
        manualDescription={manualDescription}
        onManualDescription={setManualDescription}
        manualDiscovering={manualDiscovering}
        brands={brands}
        categories={categories}
        onManualAdd={() => void handleManualAdd()}
        onManualRetry={() => void handleManualRetry()}
      />
    </>
  );
}

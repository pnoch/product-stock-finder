import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { storage } from "../storage";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { discoverListings, customProductSlug } from "../../../lib/listing-discovery";
import { manualAddProduct, rediscoverProduct } from "../../../lib/manual-add";
import { matchModels, parseModelInput } from "../../../lib/bulk-import";
import { runDiscoveryLoop } from "../../../lib/bulk-discovery";
import { nextTagColor } from "../../../lib/tags";
import type { DistributorListing } from "../../../lib/types";
import { useToast } from "../hooks/use-toast";
import { useSearchData } from "../hooks/use-search-data";
import { isUrlLike } from "../lib/url-like";
import { TagPickerDialog } from "../components/search/TagPickerDialog";
import { BulkImportDialog } from "../components/search/BulkImportDialog";
import { ManualAddDialog } from "../components/search/ManualAddDialog";
import { SearchResults } from "../components/search/SearchResults";
import { SearchHeader } from "../components/search/SearchHeader";
import { SearchFilters } from "../components/search/SearchFilters";

import { RECENT_KEY, recordRecent, type CatalogSort } from "../components/search-chrome";

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<{ title: string; message: string; retry: boolean } | null>(null);
  const { toast, showToast } = useToast();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlParsing, setUrlParsing] = useState(false);
  const [manualParsing, setManualParsing] = useState(false);
  const [manualDiscovering, setManualDiscovering] = useState(false);
  const [manualProgress, setManualProgress] = useState<string | null>(null);
  const [manualTimedOut, setManualTimedOut] = useState<{ id: string; name: string; modelNumber: string } | null>(null);
  const [manualRetrying, setManualRetrying] = useState(false);
  const [manualError, setManualError] = useState<{ title: string; message: string; retry: boolean } | null>(null);
  const [searchTagIds, setSearchTagIds] = useState<string[]>([]);
  const [searchTagMode, setSearchTagMode] = useState<"any" | "all">("any");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");

  const {
    trackedIds,
    setTrackedIds,
    discoveredProducts,
    recentSearches,
    setRecentSearches,
    tagDefinitions,
    setTagDefinitions,
    pendingTags,
    setPendingTags,
    inputRef,
    tagCounts,
    categories,
    brands,
    sortedResults,
  } = useSearchData({
    query,
    searchTagIds,
    searchTagMode,
    selectedCategory,
    selectedBrand,
    catalogSort,
  });

  const handleAdd = async (product: (typeof PRODUCT_CATALOG)[number]) => {
    const tags = pendingTags[product.id] ?? [];
    try {
      await storage.addToWatchlist({ ...product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags });
      if (tags.length) setPendingTags((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
      setTrackedIds((prev) => new Set([...prev, product.id]));
      showToast(`Added ${product.name}`);
      navigate("/watchlist");
      if (query.trim()) setRecentSearches(recordRecent(query));
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed"); }
  };

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await discoverProduct(query, storage);
      if (res) {
        await storage.addToWatchlist({ ...res.product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
        // Mark it tracked so the catalog row stops offering "Add" (mobile
        // reloads trackedIds via loadData()).
        setTrackedIds((prev) => new Set([...prev, res.product.id]));
        setRecentSearches(recordRecent(query));
        navigate(`/product/${res.product.id}`);
      } else { showToast("Discovery failed"); }
    } catch (e) {
      const errState = toDiscoverErrorState(e);
      setDiscoverError(errState);
      showToast(errState.title);
    } finally { setDiscovering(false); }
  }, [query, discovering, navigate, showToast, setTrackedIds, setRecentSearches]);

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
  }, [newTagName, tagPickerFor, showToast, setTagDefinitions, setPendingTags]);

  const bulkPreview = useMemo(() => matchModels(parseModelInput(bulkText)), [bulkText]);
  const bulkNew = useMemo(() => bulkPreview.matched.filter((p) => !trackedIds.has(p.id)), [bulkPreview, trackedIds]);
  const handleBulkImport = async () => {
    if (bulkImporting || bulkNew.length === 0) return;
    setBulkImporting(true);
    try {
      // allSettled so one storage rejection doesn't abort the rest of the
      // import (mobile does the same); only count the writes that landed.
      const results = await Promise.allSettled(
        bulkNew.map((it) => storage.addToWatchlist({ ...it, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] })),
      );
      // Only writes that landed: addToWatchlist resolves false for a
      // duplicate, which the fulfilled-status check used to count as an import.
      const added = bulkNew.filter(
        (_, i) =>
          results[i]!.status === "fulfilled" &&
          (results[i] as PromiseFulfilledResult<boolean>).value === true,
      );
      setTrackedIds((prev) => new Set([...prev, ...added.map((p) => p.id)]));
      setBulkText(""); setBulkOpen(false);
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
  const handleManualParse = async () => {
    if (!pasteText.trim() || manualParsing) return;
    setManualParsing(true);
    setManualError(null);
    try {
      const res = await discoverProduct(pasteText.trim(), storage);
      if (res) {
        setManualName(res.product.name ?? "");
        setManualModel(res.product.modelNumber ?? "");
        setManualBrand(res.product.brand ?? "");
        setManualCategory(res.product.category ?? "");
      } else {
        setManualError({ title: "Discovery Failed", message: "We couldn't find that product. Try again.", retry: true });
      }
    } catch (e) {
      setManualError(toDiscoverErrorState(e));
    } finally {
      setManualParsing(false);
    }
  };
  const handleUrlFetch = async () => {
    const text = urlInput.trim();
    if (!text || urlParsing || !isUrlLike(text)) return;
    setUrlParsing(true);
    setManualError(null);
    try {
      const res = await discoverProduct(text, storage);
      if (res) {
        setManualName(res.product.name ?? "");
        setManualModel(res.product.modelNumber ?? "");
        setManualBrand(res.product.brand ?? "");
        setManualCategory(res.product.category ?? "");
      } else {
        setManualError({ title: "Discovery Failed", message: "We couldn't find that product. Try again.", retry: true });
      }
    } catch (e) {
      setManualError(toDiscoverErrorState(e));
    } finally {
      setUrlParsing(false);
    }
  };
  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualModel.trim()) { showToast("Name and model required"); return; }
    const slug = customProductSlug(manualModel.trim());
    if (trackedIds.has(slug)) { showToast("Already Tracked — that model number is already in your watchlist."); return; }
    if (manualDiscovering) return;
    const id = slug;
    const prod = { id, name: manualName.trim(), modelNumber: manualModel.trim(), brand: manualBrand.trim() || "Unknown", category: manualCategory.trim() || categories[0] || "Other", description: manualDescription.trim() };
    const resetManualForm = () => {
      setManualOpen(false); setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory(""); setManualDescription("");
      setPasteText(""); setUrlInput(""); setManualError(null); setManualProgress(null); setManualTimedOut(null);
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
        input: { ...prod, tags: [] },
        onProgress: (done, total) => setManualProgress(`Discovering ${done}/${total}…`),
      });
      if (result.status === "duplicate") { showToast("Already Tracked — that model number is already in your watchlist."); return; }
      setTrackedIds((prev) => new Set([...prev, id]));
      if (result.timedOut) {
        setManualTimedOut({ id, name: prod.name, modelNumber: prod.modelNumber });
        showToast(`Added ${prod.name} with no listings — discovery found nothing`);
        return;
      }
      resetManualForm();
      showToast(result.discovered > 0 ? `Added ${prod.name}` : `Added ${prod.name} with no listings — discovery found nothing`);
    } catch {
      if (created) {
        // Best-effort: keep the product with no listings (today's behavior).
        setTrackedIds((prev) => new Set([...prev, id]));
        resetManualForm();
        showToast(`Added ${prod.name} with no listings — discovery found nothing`);
      } else {
        showToast("Failed to add");
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
        setManualOpen(false); setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory(""); setManualDescription("");
        setPasteText(""); setUrlInput(""); setManualError(null);
        showToast(res.discovered > 0 ? `Added ${name}` : `Added ${name} with no listings — discovery found nothing`);
      }
    } catch {
      showToast("Discovery failed — try again");
    } finally {
      setManualRetrying(false);
      setManualProgress(null);
    }
  };
  const closeManualModal = () => { setManualTimedOut(null); setManualOpen(false); };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <SearchHeader
        query={query}
        onQuery={setQuery}
        recentSearches={recentSearches}
        onRecent={setQuery}
        onClearRecent={() => {
          localStorage.removeItem(RECENT_KEY);
          setRecentSearches([]);
        }}
        onBulkOpen={() => setBulkOpen(true)}
        onManualOpen={() => {
          setManualModel(query);
          setPasteText("");
          setUrlInput("");
          setManualDescription("");
          setManualError(null);
          setManualProgress(null);
          setManualTimedOut(null);
          setManualOpen(true);
        }}
        inputRef={inputRef}
        onEnter={() => setRecentSearches(recordRecent(query))}
        discoveredCount={discoveredProducts.length}
      />

      <SearchFilters
        tagDefinitions={tagDefinitions}
        searchTagIds={searchTagIds}
        searchTagMode={searchTagMode}
        tagCounts={tagCounts}
        onToggleTag={(id) =>
          setSearchTagIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onChangeTagMode={setSearchTagMode}
        onClearTags={() => setSearchTagIds([])}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        brands={brands}
        selectedBrand={selectedBrand}
        onSelectBrand={setSelectedBrand}
        catalogSort={catalogSort}
        onCatalogSort={setCatalogSort}
        resultCount={sortedResults.length}
        query={query}
      />

      <SearchResults
        results={sortedResults}
        trackedIds={trackedIds}
        pendingTags={pendingTags}
        tagDefinitions={tagDefinitions}
        query={query}
        searchTagIds={searchTagIds}
        discovering={discovering}
        discoverError={discoverError}
        onOpen={(productId) => navigate(`/product/${productId}`)}
        onAdd={(product) => void handleAdd(product)}
        onAssignTags={setTagPickerFor}
        onDiscover={() => void handleDiscover()}
      />

      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>}

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
            const nxt = cur.includes(tagId)
              ? cur.filter((id) => id !== tagId)
              : [...cur, tagId];
            return { ...prev, [tagPickerFor]: nxt };
          });
        }}
        onCreateTag={() => void handleCreateTag()}
        onClear={() => {
          if (!tagPickerFor) return;
          setPendingTags((p) => {
            const n = { ...p };
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
      <ManualAddDialog
        open={manualOpen}
        pasteText={pasteText}
        onPasteText={setPasteText}
        urlInput={urlInput}
        onUrlInput={setUrlInput}
        urlParsing={urlParsing}
        manualParsing={manualParsing}
        manualError={manualError}
        manualProgress={manualProgress}
        manualTimedOut={manualTimedOut}
        manualRetrying={manualRetrying}
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
        onManualParse={() => void handleManualParse()}
        onUrlFetch={() => void handleUrlFetch()}
        onManualAdd={() => void handleManualAdd()}
        onManualRetry={() => void handleManualRetry()}
        onClose={closeManualModal}
      />
    </div>
  );
}

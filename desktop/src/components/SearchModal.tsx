import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Check, Plus, Wand2, Loader2, Upload, PenLine, X } from "lucide-react";
import { PRODUCT_CATALOG, getAllCategories, getAllBrands } from "@shared/catalog";
import Fuse from "fuse.js";
import { storage } from "../storage";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { discoverProduct } from "../../../lib/llm-discovery";
import { matchModels, parseModelInput } from "../../../lib/bulk-import";
import type { TagDefinition } from "../../../lib/types";

const RECENT_KEY = "recent_searches";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string").slice(0, 8) : [];
  } catch { return []; }
}
function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch {}
}
function recordRecent(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return loadRecent();
  const list = loadRecent();
  const filtered = list.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered].slice(0, 8);
  saveRecent(updated);
  return updated;
}

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
  const [toast, setToast] = useState<string | null>(null);
  const [discoveredProducts, setDiscoveredProducts] = useState<typeof PRODUCT_CATALOG>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
      storage.getWatchlist().then((products) => setTrackedIds(new Set(products.map((p) => p.id))));
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

  const results = useMemo(() => {
    if (!query.trim()) return combinedCatalog;
    // Fuse ranked search threshold 0.4 keys modelNumber 0.4/name 0.3 etc.
    const fuse = new Fuse(combinedCatalog, {
      keys: [
        { name: "modelNumber", weight: 0.4 },
        { name: "name", weight: 0.3 },
        { name: "brand", weight: 0.15 },
        { name: "category", weight: 0.1 },
        { name: "description", weight: 0.05 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
    return fuse.search(query).map((r) => r.item);
  }, [query, combinedCatalog]);

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  const handleAdd = async (product: (typeof PRODUCT_CATALOG)[number]) => {
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
      setToast(`Added ${product.name}`);
      setTimeout(() => setToast(null), 2500);
      if (query.trim()) setRecentSearches(recordRecent(query));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add to watchlist";
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    try {
      const result = await discoverProduct(query);
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
        setToast("Discovery failed — try a more specific search");
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, onClose]);

  const bulkPreview = useMemo(() => matchModels(parseModelInput(bulkText)), [bulkText]);
  const bulkNew = bulkPreview.matched.filter((p) => !trackedIds.has(p.id));

  const handleBulkImport = async () => {
    if (bulkImporting || bulkNew.length === 0) return;
    setBulkImporting(true);
    try {
      for (const item of bulkNew) {
        await storage.addToWatchlist({ ...item, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
      }
      setTrackedIds((prev) => new Set([...prev, ...bulkNew.map((p) => p.id)]));
      setBulkText("");
      setBulkOpen(false);
      setToast(`Imported ${bulkNew.length} product${bulkNew.length !== 1 ? "s" : ""}`);
      setTimeout(() => setToast(null), 2500);
    } finally { setBulkImporting(false); }
  };

  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualModel.trim()) {
      setToast("Name and model required");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const id = `manual-${Date.now()}`;
    const product = { id, name: manualName.trim(), modelNumber: manualModel.trim(), brand: manualBrand.trim() || "Unknown", category: manualCategory.trim() || categories[0] || "Other", description: "" };
    try {
      await storage.addToWatchlist({ ...product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
      setTrackedIds((prev) => new Set([...prev, id]));
      setManualOpen(false);
      setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory("");
      setToast(`Added ${product.name}`);
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to add");
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Search Products">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Bulk import">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={() => setManualOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Manual add">
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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((product) => {
            const isTracked = trackedIds.has(product.id);
            const pending = pendingTags[product.id] ?? [];
            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm hover:scale-[1.01] transition-all duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ProductImage productId={product.id} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {product.brand} · {product.category} · {product.modelNumber}
                    </div>
                    {Object.keys(tagDefinitions).length > 0 && !isTracked && (
                      <button onClick={() => setTagPickerFor(product.id)} className="mt-1 text-xs text-brand-600 hover:underline">
                        {pending.length ? `${pending.length} tag${pending.length !== 1 ? "s" : ""} selected` : "Assign tags"}
                      </button>
                    )}
                    {pending.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pending.map((tid) => {
                          const def = tagDefinitions[tid];
                          if (!def) return null;
                          return <span key={tid} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: def.color }}>{def.name}</span>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {isTracked ? (
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium shrink-0 ml-2">
                    <Check className="w-4 h-4" /> Tracked
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(product)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors duration-200 cursor-pointer shrink-0 ml-2"
                    aria-label={`Add ${product.name} to watchlist`}
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
            );
          })}
          {results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No products found.
              </p>
              {query.trim().length > 0 && !discovering && (
                <button
                  onClick={handleDiscover}
                  className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium text-sm hover:bg-brand-500/20 transition-colors duration-200 cursor-pointer"
                  aria-label="Discover product with AI"
                >
                  <Wand2 className="w-5 h-5" />
                  Discover with AI
                </button>
              )}
              {discovering && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Discovering product...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium shadow-lg" role="alert">
            {toast}
          </div>
        )}
      </Modal>

      {/* Tag picker for pre-assignment */}
      {tagPickerFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setTagPickerFor(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Assign tags</h3>
              <button onClick={() => setTagPickerFor(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.values(tagDefinitions).map((def) => {
                const selected = (pendingTags[tagPickerFor] ?? []).includes(def.id);
                return (
                  <label key={def.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setPendingTags((prev) => {
                        const cur = prev[tagPickerFor] ?? [];
                        const next = selected ? cur.filter((id) => id !== def.id) : [...cur, def.id];
                        return { ...prev, [tagPickerFor]: next };
                      })}
                      className="rounded"
                    />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: def.color }} />
                    <span className="text-sm">{def.name}</span>
                  </label>
                );
              })}
              {Object.keys(tagDefinitions).length === 0 && <p className="text-sm text-gray-500">No tags yet. Create tags in Settings.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setTagPickerFor(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Done</button>
              <button onClick={() => { setPendingTags((prev) => { const n = { ...prev }; delete n[tagPickerFor]; return n; }); setTagPickerFor(null); }} className="px-3 py-1.5 text-sm text-gray-500">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setBulkOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Bulk Import</h3>
            <p className="text-xs text-gray-500 mb-2">Paste model numbers — one per line or comma separated. Eg CRS804-4DDQ-hRM</p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder={"CRS804-4DDQ-hRM\nCCR2216-1G-12XS-2XQ"} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3" />
            {bulkText.trim() && (
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                {bulkPreview.matched.length} matched · {bulkPreview.unmatched.length} not found · {bulkNew.length} new · {bulkPreview.matched.length - bulkNew.length} already tracked
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkOpen(false)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
              <button onClick={handleBulkImport} disabled={bulkNew.length === 0 || bulkImporting} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50">
                {bulkImporting ? "Importing…" : `Import ${bulkNew.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Sheet */}
      {manualOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setManualOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Manual Add</h3>
            <div className="space-y-3">
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Product name *" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              <input value={manualModel} onChange={(e) => setManualModel(e.target.value)} placeholder="Model number *" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              <input value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} placeholder="Brand" list="brand-list" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
              <input value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} placeholder="Category" list="cat-list" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setManualOpen(false)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
              <button onClick={handleManualAdd} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

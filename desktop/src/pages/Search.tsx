import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Search as SearchIcon, Check, Plus, Wand2, Loader2, Upload, PenLine, X } from "lucide-react";
import { PRODUCT_CATALOG, getAllCategories, getAllBrands } from "@shared/catalog";
import Fuse from "fuse.js";
import { storage } from "../storage";
import { ProductImage } from "../components/ProductImage";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { matchModels, parseModelInput } from "../../../lib/bulk-import";
import type { TagDefinition } from "../../../lib/types";
import { TagFilterRow } from "../components/TagFilterRow";
import { countTagMatches, filterWatchlist } from "../../../lib/watchlist-org";
import { useToast } from "../hooks/use-toast";

const RECENT_KEY = "recent_searches";
function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string").slice(0, 8) : [];
  } catch { return []; }
}
function saveRecent(list: string[]) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch {} }
function recordRecent(q: string): string[] {
  const t = q.trim(); if (!t) return loadRecent();
  const list = loadRecent();
  const filtered = list.filter((x) => x.toLowerCase() !== t.toLowerCase());
  const upd = [t, ...filtered].slice(0, 8); saveRecent(upd); return upd;
}

type CatalogSort = "relevance" | "name" | "brand" | "price";
const CATALOG_SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Price" },
];

function PillFilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mr-1">{label}</span>
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selected === null ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
        aria-label={`${label} All`}
      >
        All
      </button>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(active ? null : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
            aria-label={`${label} ${opt}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [watchlistProducts, setWatchlistProducts] = useState<Awaited<ReturnType<typeof storage.getWatchlist>>>([]);
  const [discoveredProducts, setDiscoveredProducts] = useState<typeof PRODUCT_CATALOG>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  // Derived arrays for Set/object reactivity — keeps effects in sync when identity changes
  const pendingTagsDerived = useMemo(() => Object.entries(pendingTags).flatMap(([k, v]) => [k, ...v]), [pendingTags]);
  const trackedIdsArray = useMemo(() => Array.from(trackedIds), [trackedIds]);
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
  const [searchTagIds, setSearchTagIds] = useState<string[]>([]);
  const [searchTagMode, setSearchTagMode] = useState<"any" | "all">("any");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storage.getWatchlist().then((p) => { setTrackedIds(new Set(p.map((x) => x.id))); setWatchlistProducts(p); }).catch(() => {});
    storage.getDiscoveredProducts().then((disc) => {
      let list = disc.map((p) => ({ id: p.id, name: p.name, modelNumber: p.modelNumber, brand: p.brand, category: p.category, description: p.description ?? "" }));
      if (list.length > 50) list = list.slice(-50);
      setDiscoveredProducts(list as typeof PRODUCT_CATALOG);
    }).catch(() => {});
    setRecentSearches(loadRecent());
    storage.getSettings().then((s) => setTagDefinitions((s.tagDefinitions ?? {}) as Record<string, TagDefinition>)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const combinedCatalog = useMemo(() => {
    if (discoveredProducts.length === 0) return PRODUCT_CATALOG;
    const ids = new Set(PRODUCT_CATALOG.map((p) => p.id));
    return [...PRODUCT_CATALOG, ...discoveredProducts.filter((p) => !ids.has(p.id))] as typeof PRODUCT_CATALOG;
  }, [discoveredProducts]);

  const tagMatchedIds = useMemo(() => {
    if (searchTagIds.length === 0) return null;
    const matching = filterWatchlist(watchlistProducts, {
      region: "all",
      status: "all",
      query: "",
      tagIds: searchTagIds,
      tagMatchMode: searchTagMode,
    });
    return new Set(matching.map((p) => p.id));
  }, [watchlistProducts, searchTagIds, searchTagMode]);

  const tagCounts = useMemo(() => {
    return countTagMatches(watchlistProducts, {
      region: "all",
      status: "all",
      query,
    });
  }, [watchlistProducts, query]);

  const results = useMemo(() => {
    let base: typeof combinedCatalog;
    if (!query.trim()) base = combinedCatalog;
    else {
      const fuse = new Fuse(combinedCatalog, {
        keys: [{ name: "modelNumber", weight: 0.4 }, { name: "name", weight: 0.3 }, { name: "brand", weight: 0.15 }, { name: "category", weight: 0.1 }, { name: "description", weight: 0.05 }],
        threshold: 0.4, includeScore: true, minMatchCharLength: 2, ignoreLocation: true,
      });
      base = fuse.search(query).map((r) => r.item);
    }
    if (searchTagIds.length > 0) {
      // Show watchlist tag matches plus untracked catalog products
      base = base.filter((p) => tagMatchedIds?.has(p.id) || !trackedIds.has(p.id));
    }
    // Ensure derived array is referenced so linter sees pendingTagsDerived as dep
    void pendingTagsDerived;
    return base;
  }, [query, combinedCatalog, searchTagIds, searchTagMode, pendingTags, pendingTagsDerived, tagMatchedIds, trackedIds]);

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
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return copy;
    }
  }, [categoryBrandFiltered, catalogSort]);

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
      const res = await discoverProduct(query);
      if (res) {
        await storage.addToWatchlist({ ...res.product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
        setRecentSearches(recordRecent(query));
        navigate(`/product/${res.product.id}`);
      } else { showToast("Discovery failed"); }
    } catch (e) {
      const errState = toDiscoverErrorState(e);
      setDiscoverError(errState);
      showToast(errState.title);
    } finally { setDiscovering(false); }
  }, [query, discovering, navigate]);

  const bulkPreview = useMemo(() => matchModels(parseModelInput(bulkText)), [bulkText]);
  const bulkNew = useMemo(() => bulkPreview.matched.filter((p) => !trackedIds.has(p.id)), [bulkPreview, trackedIdsArray, trackedIds]);
  const handleBulkImport = async () => {
    if (bulkImporting || bulkNew.length === 0) return;
    setBulkImporting(true);
    try {
      for (const it of bulkNew) await storage.addToWatchlist({ ...it, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
      setTrackedIds((prev) => new Set([...prev, ...bulkNew.map((p) => p.id)]));
      setBulkText(""); setBulkOpen(false);
      showToast(`Imported ${bulkNew.length}`);
    } finally { setBulkImporting(false); }
  };
  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualModel.trim()) { showToast("Name and model required"); return; }
    const id = `manual-${Date.now()}`;
    const prod = { id, name: manualName.trim(), modelNumber: manualModel.trim(), brand: manualBrand.trim() || "Unknown", category: manualCategory.trim() || categories[0] || "Other", description: "" };
    await storage.addToWatchlist({ ...prod, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
    setTrackedIds((prev) => new Set([...prev, id]));
    setManualOpen(false); setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory("");
    showToast(`Added ${prod.name}`);
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Search Products</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><Upload className="w-4 h-4" /> Bulk Import</button>
          <button onClick={() => { setManualModel(query); setManualOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><PenLine className="w-4 h-4" /> Manual Add</button>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) setRecentSearches(recordRecent(query)); }} placeholder="Search by name, model, or brand..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" aria-label="Search products" />
      </div>

      {query.length === 0 && recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500">Recent:</span>
          {recentSearches.map((q) => <button key={q} onClick={() => setQuery(q)} className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>)}
          <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 ml-1">Clear</button>
        </div>
      )}

      {discoveredProducts.length > 0 && <p className="text-xs text-gray-500">{discoveredProducts.length} discovered products included</p>}

      {Object.keys(tagDefinitions).length > 0 && (
        <TagFilterRow
          tagDefinitions={tagDefinitions}
          selectedTagIds={searchTagIds}
          tagMatchMode={searchTagMode}
          counts={tagCounts}
          onToggleTag={(id) => setSearchTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
          onChangeMode={setSearchTagMode}
          onClearAll={() => setSearchTagIds([])}
        />
      )}

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
            >
              {opt.label}
            </button>
          );
        })}
        {(selectedCategory || selectedBrand) && (
          <button onClick={() => { setSelectedCategory(null); setSelectedBrand(null); }} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-1">Clear</button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}</span>
        {query.trim() && <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600">{query}</span>}
      </div>

      {searchTagIds.length > 0 && (
        <p className="text-xs text-gray-500 px-1">Tag filter: showing watchlist matches only — clear to see catalog</p>
      )}

      <div className="space-y-2">
        {sortedResults.map((product) => {
          const isTracked = trackedIds.has(product.id);
          const pending = pendingTags[product.id] ?? [];
          return (
            <div key={product.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ProductImage productId={product.id} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{product.name}</div>
                  <div className="text-xs text-gray-500 truncate">{product.brand} · {product.category} · {product.modelNumber}</div>
                  {Object.keys(tagDefinitions).length > 0 && !isTracked && (
                    <button onClick={() => setTagPickerFor(product.id)} className="mt-1 text-xs text-brand-600 hover:underline">{pending.length ? `${pending.length} tag${pending.length !== 1 ? "s" : ""}` : "Assign tags"}</button>
                  )}
                  {pending.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{pending.map((tid) => { const d = tagDefinitions[tid]; if (!d) return null; return <span key={tid} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: d.color }}>{d.name}</span>; })}</div>}
                </div>
              </div>
              {isTracked ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium ml-2"><Check className="w-4 h-4" /> Tracked</span> : <button onClick={() => handleAdd(product)} className="ml-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>}
            </div>
          );
        })}
        {sortedResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 mb-4">No products found.</p>
            {query.trim() && !discovering && <button onClick={handleDiscover} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 text-sm font-medium"><Wand2 className="w-4 h-4" /> Discover with AI</button>}
            {discoverError && (
              <div role="alert" className="mt-4 mx-auto max-w-md p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-left">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">{discoverError.title}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{discoverError.message}</p>
                {discoverError.retry && <button onClick={() => void handleDiscover()} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">Retry</button>}
              </div>
            )}
            {discovering && <div className="flex flex-col items-center gap-2 mt-4"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /><span className="text-sm text-gray-500">Discovering...</span></div>}
          </div>
        )}
      </div>

      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>}

      {tagPickerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagPickerFor(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-sm">Assign tags</h3><button onClick={() => setTagPickerFor(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button></div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.values(tagDefinitions).map((def) => {
                const sel = (pendingTags[tagPickerFor] ?? []).includes(def.id);
                return <label key={def.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><input type="checkbox" checked={sel} onChange={() => setPendingTags((prev) => { const cur = prev[tagPickerFor] ?? []; const nxt = sel ? cur.filter((id) => id !== def.id) : [...cur, def.id]; return { ...prev, [tagPickerFor]: nxt }; })} /><span className="w-3 h-3 rounded-full" style={{ backgroundColor: def.color }} /><span className="text-sm">{def.name}</span></label>;
              })}
              {Object.keys(tagDefinitions).length === 0 && <p className="text-sm text-gray-500">No tags yet.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4"><button onClick={() => setTagPickerFor(null)} className="px-3 py-1.5 rounded-lg border text-sm">Done</button><button onClick={() => { setPendingTags((p) => { const n = { ...p }; delete n[tagPickerFor]; return n; }); setTagPickerFor(null); }} className="px-3 py-1.5 text-sm text-gray-500">Clear</button></div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBulkOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Upload className="w-4 h-4" /> Bulk Import</h3>
            <p className="text-xs text-gray-500 mb-2">Paste model numbers (e.g. CRS326-24S) — one per line or comma-separated.</p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder="CRS804-4DDQ-hRM\nCCR2216-1G-12XS-2XQ" className="w-full p-3 rounded-lg border text-sm mb-3" />
            {bulkText.trim() && (
              <div className="mb-3 space-y-1">
                <p className="text-xs font-semibold">{bulkPreview.matched.length} matched · {bulkPreview.unmatched.length} not found · {bulkNew.length} new{bulkPreview.matched.length - bulkNew.length > 0 ? ` · ${bulkPreview.matched.length - bulkNew.length} already tracked` : ""}</p>
                {bulkPreview.unmatched.slice(0, 5).map((m) => <p key={m} className="text-xs text-red-600">Not found: {m}</p>)}
                {bulkPreview.unmatched.length > 5 && <p className="text-xs text-gray-500">+{bulkPreview.unmatched.length - 5} more not found</p>}
                {bulkPreview.matched.length - bulkNew.length > 0 && <p className="text-xs text-gray-500">{bulkPreview.matched.length - bulkNew.length} already in watchlist</p>}
              </div>
            )}
            <div className="flex justify-end gap-2"><button onClick={() => setBulkOpen(false)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button><button onClick={handleBulkImport} disabled={bulkNew.length === 0 || bulkImporting} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">{bulkImporting ? "Importing…" : `Import ${bulkNew.length}`}</button></div>
          </div>
        </div>
      )}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setManualOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Manual Add</h3>
            <div className="space-y-3">
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Product name *" className="w-full px-3 py-2 rounded-lg border text-sm" />
              <input value={manualModel} onChange={(e) => setManualModel(e.target.value)} placeholder="Model number *" className="w-full px-3 py-2 rounded-lg border text-sm" />
              <input value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} placeholder="Brand" list="b-list" className="w-full px-3 py-2 rounded-lg border text-sm" /><datalist id="b-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
              <input value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} placeholder="Category" list="c-list" className="w-full px-3 py-2 rounded-lg border text-sm" /><datalist id="c-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="flex justify-end gap-2 mt-4"><button onClick={() => setManualOpen(false)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button><button onClick={handleManualAdd} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm">Add</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

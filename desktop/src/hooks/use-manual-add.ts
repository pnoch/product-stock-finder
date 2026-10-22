import { useState } from "react";
import { storage } from "../storage";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { discoverListings, customProductSlug } from "../../../lib/listing-discovery";
import { manualAddProduct, rediscoverProduct } from "../../../lib/manual-add";
import { isUrlLike } from "../lib/url-like";

export function useManualAdd({
  categories,
  trackedIds,
  setTrackedIds,
  showToast,
}: {
  categories: string[];
  trackedIds: Set<string>;
  setTrackedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (message: string) => void;
}) {
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

  const resetManualForm = () => {
    setManualOpen(false); setManualName(""); setManualModel(""); setManualBrand(""); setManualCategory(""); setManualDescription("");
    setPasteText(""); setUrlInput(""); setManualError(null); setManualProgress(null); setManualTimedOut(null);
  };

  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualModel.trim()) { showToast("Name and model required"); return; }
    const slug = customProductSlug(manualModel.trim());
    if (trackedIds.has(slug)) { showToast("Already Tracked — that model number is already in your watchlist."); return; }
    if (manualDiscovering) return;
    const id = slug;
    const prod = { id, name: manualName.trim(), modelNumber: manualModel.trim(), brand: manualBrand.trim() || "Unknown", category: manualCategory.trim() || categories[0] || "Other", description: manualDescription.trim() };
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
        resetManualForm();
        showToast(res.discovered > 0 ? `Added ${name}` : `Added ${name} with no listings — discovery found nothing`);
      }
    } catch {
      showToast("Discovery failed — try again");
    } finally {
      setManualRetrying(false);
      setManualProgress(null);
    }
  };

  const openManual = (model: string) => {
    setManualModel(model);
    setPasteText("");
    setUrlInput("");
    setManualDescription("");
    setManualError(null);
    setManualProgress(null);
    setManualTimedOut(null);
    setManualOpen(true);
  };

  const closeManualModal = () => { setManualTimedOut(null); setManualOpen(false); };

  return {
    manualOpen,
    manualName,
    setManualName,
    manualModel,
    setManualModel,
    manualBrand,
    setManualBrand,
    manualCategory,
    setManualCategory,
    manualDescription,
    setManualDescription,
    pasteText,
    setPasteText,
    urlInput,
    setUrlInput,
    urlParsing,
    manualParsing,
    manualDiscovering,
    manualProgress,
    manualTimedOut,
    manualRetrying,
    manualError,
    handleManualParse,
    handleUrlFetch,
    handleManualAdd,
    handleManualRetry,
    openManual,
    closeManualModal,
  };
}

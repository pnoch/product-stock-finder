import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { useEntitlements } from "@/hooks/use-entitlements";
import { track } from "@/lib/telemetry";
import { shouldEnforceFreeLimits, canAddToWatchlist } from "@/lib/pro-features";
import { getWatchlist, addToWatchlist, updateProductListings } from "@/lib/storage";
import { DISCOVER_TIMEOUT_MS, manualAddProduct } from "@/lib/manual-add";
import { customProductSlug, discoverListings } from "@/lib/listing-discovery";
import {
  buildMarketplaceProduct,
  marketplaceBrandName,
  marketplaceShortName,
  parseManualPrice,
} from "@/lib/marketplace";
import { fetchParsedProduct } from "@/lib/server-product-parse";
import { fetchMarketplaceResolution } from "@/lib/server-marketplace";
import {
  isEbayInput,
  isFacebookInput,
  isLazadaInput,
  isMarketplaceInput,
  marketplaceResolutionMessage,
  parseMarketplaceUrl,
  type MarketplaceIdentity,
} from "@/shared/marketplace-url";
import type { EbaySearchListing } from "@/shared/ebay-search";
import { EMPTY_DRAFT, type Draft } from "@/components/search/manual-add-helpers";

export function useManualAddSheet({
  visible,
  onClose,
  initialText,
  initialEbayListing,
  trackedIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
  initialEbayListing?: EbaySearchListing;
  trackedIds: Set<string>;
  onAdded?: () => void;
}) {
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [raw, setRaw] = useState(initialText ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [urlParsing, setUrlParsing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [marketplace, setMarketplace] = useState<MarketplaceIdentity | null>(null);
  const [variant, setVariant] = useState("");
  const [seller, setSeller] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const activeRef = useRef(true);

  const isUrlLike = (s: string) => /^https?:\/\/\S+/i.test(s.trim());

  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  const resetForm = () => {
    activeRef.current = true;
    setRaw(initialText ?? "");
    setUrlInput("");
    setDraft(null);
    setMarketplace(null);
    setVariant("");
    setSeller("");
    setManualPrice("");
    setAdding(false);
    setProgress(null);
    setAiFailed(false);
    if (initialEbayListing) {
      const parsed = parseMarketplaceUrl(initialEbayListing.url);
      if (
        parsed.kind === "product" &&
        parsed.identity.platform === "ebay" &&
        parsed.identity.itemId === initialEbayListing.itemId
      ) {
        setMarketplace(parsed.identity);
        setDraft({
          ...EMPTY_DRAFT,
          name: initialEbayListing.title,
          modelNumber: `ebay-us-${parsed.identity.itemId}`,
        });
        setSeller(initialEbayListing.seller ?? "");
        setManualPrice(
          initialEbayListing.currency === "USD" &&
            initialEbayListing.price !== null
            ? String(initialEbayListing.price)
            : "",
        );
      }
    }
  };

  const reset = () => {
    setRaw(initialText ?? "");
    setUrlInput("");
    setDraft(null);
    setMarketplace(null);
    setParsing(false);
    setUrlParsing(false);
    setAdding(false);
    setProgress(null);
    setAiFailed(false);
  };

  const handleClose = () => {
    if (parsing || urlParsing || adding) return;
    reset();
    onClose();
  };

  const handleForceClose = () => {
    activeRef.current = false;
    setAdding(false);
    setProgress(null);
    reset();
    onClose();
  };

  const handleMarketplaceParse = async (text: string) => {
    const result = await fetchMarketplaceResolution(text);
    if (!activeRef.current) return;
    const platform: MarketplaceIdentity["platform"] = isFacebookInput(text)
      ? "facebook"
      : isLazadaInput(text)
        ? "lazada"
        : isEbayInput(text)
          ? "ebay"
          : "shopee";
    const brand = marketplaceBrandName(platform);
    if (result.kind !== "product") {
      showAlert(
        `${brand} link import`,
        marketplaceResolutionMessage(result, platform),
      );
      return;
    }
    const identity = result.identity;
    setMarketplace(identity);
    setVariant("");
    setSeller("");
    setManualPrice("");
    setDraft({
      ...EMPTY_DRAFT,
      modelNumber:
        identity.platform === "lazada"
          ? `lazada-th-${identity.itemId}-${identity.skuId}`
          : identity.platform === "shopee"
            ? `shopee-th-${identity.shopId}-${identity.itemId}`
            : identity.platform === "ebay"
              ? `ebay-us-${identity.itemId}`
              : `fbmp-${identity.itemId}`,
    });
    setAiFailed(false);
  };

  const handleParse = async () => {
    const text = raw.trim();
    if (!text || parsing) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setParsing(true);
    try {
      if (isMarketplaceInput(text)) {
        await handleMarketplaceParse(text);
        return;
      }
      const parsed = await fetchParsedProduct(text);
      if (parsed) {
        setDraft(parsed);
        setAiFailed(false);
      } else {
        setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
        setAiFailed(true);
      }
    } catch {
      setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
      setAiFailed(true);
    } finally {
      setParsing(false);
    }
  };

  const handleUrlParse = async () => {
    const text = urlInput.trim();
    if (!text || urlParsing || !isUrlLike(text)) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrlParsing(true);
    try {
      if (isMarketplaceInput(text)) {
        await handleMarketplaceParse(text);
        return;
      }
      const parsed = await fetchParsedProduct(text);
      if (parsed) {
        setDraft(parsed);
        setAiFailed(false);
      } else {
        setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
        setAiFailed(true);
      }
    } catch {
      setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
      setAiFailed(true);
    } finally {
      setUrlParsing(false);
    }
  };

  const handleAdd = async () => {
    if (!draft || adding) return;
    const name = draft.name.trim();
    const modelNumber = draft.modelNumber.trim();
    if (!name || !modelNumber) return;

    let marketplaceProduct;
    if (marketplace) {
      try {
        marketplaceProduct = buildMarketplaceProduct({
          identity: marketplace,
          name,
          variant,
          seller,
          price: manualPrice,
        });
      } catch (error) {
        showAlert(
          "Check product details",
          error instanceof Error ? error.message : "Please check the details.",
        );
        return;
      }
    }
    const id = marketplaceProduct?.id ?? customProductSlug(modelNumber);
    if (trackedIds.has(id)) {
      showAlert(
        "Already Tracked",
        "That model number is already in your watchlist.",
      );
      return;
    }
    if (shouldEnforceFreeLimits()) {
      const count = (await getWatchlist().catch(() => [])).length;
      if (!canAddToWatchlist(count, isPro)) {
        track("paywall_shown");
        setPaywallVisible(true);
        return;
      }
    }

    setAdding(true);
    let active = true;
    try {
      if (marketplaceProduct) {
        const added = await addToWatchlist(marketplaceProduct);
        if (!activeRef.current) return;
        const mpBrand = marketplaceBrandName(marketplace?.platform ?? "");
        const mpShort = marketplaceShortName(marketplace?.platform ?? "");
        if (!added) {
          showAlert(
            "Already Tracked",
            `This ${mpBrand} item is already tracked with a selected variant.`,
          );
          return;
        }
        if (Platform.OS !== "web")
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        showAlert(
          "Product Added",
          `Saved your manually entered ${mpShort} price. Automatic monitoring is unavailable.`,
        );
        reset();
        onAdded?.();
        onClose();
        return;
      }
      if (active && activeRef.current) setProgress("Searching distributors 0/…");
      const result = await manualAddProduct({
        storage: { addToWatchlist, updateProductListings },
        trackedIds,
        discover: discoverListings,
        input: {
          id,
          name,
          modelNumber,
          brand: draft.brand.trim(),
          category: draft.category.trim() || "Other",
          description: draft.description.trim(),
        },
        onProgress: (done, total) => {
          if (active && activeRef.current)
            setProgress(`Searching distributors ${done}/${total}…`);
        },
        timeoutMs: DISCOVER_TIMEOUT_MS,
      });
      if (!active || !activeRef.current) return;
      if (result.status === "duplicate") {
        showAlert(
          "Already Tracked",
          "That model number is already in your watchlist.",
        );
        return;
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        "Product Added",
        result.discovered > 0
          ? `Added "${name}" — found prices at ${result.discovered} distributor${result.discovered === 1 ? "" : "s"}.`
          : `Added "${name}". No distributor had it yet — we'll keep watching.`,
      );
      reset();
      onAdded?.();
      onClose();
    } catch {
      if (!active || !activeRef.current) return;
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Couldn't add product",
        "We couldn't add this product. Please try again.",
      );
    } finally {
      active = false;
      if (activeRef.current) {
        setAdding(false);
        setProgress(null);
      }
    }
  };

  const canAdd =
    !!draft &&
    draft.name.trim().length > 0 &&
    draft.modelNumber.trim().length > 0 &&
    (!marketplace ||
      ((marketplace.platform === "facebook" ||
        marketplace.platform === "ebay" ||
        !!variant.trim()) &&
        !!seller.trim() &&
        parseManualPrice(manualPrice) !== null));

  return {
    isPro,
    paywallVisible,
    setPaywallVisible,
    raw,
    setRaw,
    urlInput,
    setUrlInput,
    urlParsing,
    draft,
    setDraft,
    parsing,
    adding,
    progress,
    aiFailed,
    marketplace,
    setMarketplace,
    variant,
    setVariant,
    seller,
    setSeller,
    manualPrice,
    setManualPrice,
    canAdd,
    isUrlLike,
    resetForm,
    handleParse,
    handleUrlParse,
    handleAdd,
    handleClose,
    handleForceClose,
  };
}

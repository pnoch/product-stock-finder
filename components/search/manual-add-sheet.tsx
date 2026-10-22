import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { ManualAddInputStep } from "./manual-add-input-step";
import { ManualAddDraftStep } from "./manual-add-draft-step";
import { EMPTY_DRAFT, type Draft } from "./manual-add-helpers";
import { showAlert } from "@/lib/alert";
import { addToWatchlist, getWatchlist, updateProductListings } from "@/lib/storage";
import { canAddToWatchlist, shouldEnforceFreeLimits } from "@/lib/pro-features";
import { track } from "@/lib/telemetry";
import { DISCOVER_TIMEOUT_MS, manualAddProduct } from "@/lib/manual-add";
import { fetchParsedProduct } from "@/lib/server-product-parse";
import { fetchMarketplaceResolution } from "@/lib/server-marketplace";
import { buildMarketplaceProduct, marketplaceBrandName, marketplaceShortName, parseManualPrice } from "@/lib/marketplace";
import { isEbayInput, isFacebookInput, isLazadaInput, isMarketplaceInput, marketplaceResolutionMessage, parseMarketplaceUrl, type MarketplaceIdentity } from "@/shared/marketplace-url";
import type { EbaySearchListing } from "@/shared/ebay-search";
import {
  customProductSlug,
  discoverListings,
} from "@/lib/listing-discovery";

export function ManualAddSheet({
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
  const colors = useColors();
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
    // Re-arm on every open. The mount-only effect left activeRef false after
    // a Cancel, so later adds silently discarded their result and the Add
    // button stayed in a permanent spinner.
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
      if (parsed.kind === "product" && parsed.identity.platform === "ebay" && parsed.identity.itemId === initialEbayListing.itemId) {
        setMarketplace(parsed.identity);
        setDraft({ ...EMPTY_DRAFT, name: initialEbayListing.title, modelNumber: `ebay-us-${parsed.identity.itemId}` });
        setSeller(initialEbayListing.seller ?? "");
        setManualPrice(initialEbayListing.currency === "USD" && initialEbayListing.price !== null ? String(initialEbayListing.price) : "");
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
    // Abort an in-flight discovery: clearing activeRef makes handleAdd discard
    // its result, so the user isn't locked in until DISCOVER_TIMEOUT_MS.
    activeRef.current = false;
    setAdding(false);
    setProgress(null);
    reset();
    onClose();
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
      showAlert(`${brand} link import`, marketplaceResolutionMessage(result, platform));
      return;
    }
    const identity = result.identity;
    setMarketplace(identity);
    setVariant("");
    setSeller("");
    setManualPrice("");
    setDraft({
      ...EMPTY_DRAFT,
      modelNumber: identity.platform === "lazada"
        ? `lazada-th-${identity.itemId}-${identity.skuId}`
        : identity.platform === "shopee"
          ? `shopee-th-${identity.shopId}-${identity.itemId}`
          : identity.platform === "ebay"
            ? `ebay-us-${identity.itemId}`
            : `fbmp-${identity.itemId}`,
    });
    setAiFailed(false);
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
        marketplaceProduct = buildMarketplaceProduct({ identity: marketplace, name, variant, seller, price: manualPrice });
      } catch (error) {
        showAlert("Check product details", error instanceof Error ? error.message : "Please check the details.");
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
        if (!added) { showAlert("Already Tracked", `This ${mpBrand} item is already tracked with a selected variant.`); return; }
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert("Product Added", `Saved your manually entered ${mpShort} price. Automatic monitoring is unavailable.`);
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
          if (active && activeRef.current) setProgress(`Searching distributors ${done}/${total}…`);
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
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't add product", "We couldn't add this product. Please try again.");
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
      ((marketplace.platform === "facebook" || marketplace.platform === "ebay" || !!variant.trim()) &&
        !!seller.trim() &&
        parseManualPrice(manualPrice) !== null));

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={resetForm}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Add Custom Product
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={handleClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          {draft === null ? (
            <ManualAddInputStep
              colors={colors}
              raw={raw}
              onRawChange={setRaw}
              urlInput={urlInput}
              onUrlInputChange={setUrlInput}
              parsing={parsing}
              urlParsing={urlParsing}
              onParse={() => void handleParse()}
              onUrlParse={() => void handleUrlParse()}
              isUrlLike={isUrlLike}
            />
          ) : (
            <ManualAddDraftStep
              colors={colors}
              draft={draft}
              onDraftChange={setDraft}
              marketplace={marketplace}
              initialEbayListing={initialEbayListing}
              variant={variant}
              onVariantChange={setVariant}
              seller={seller}
              onSellerChange={setSeller}
              manualPrice={manualPrice}
              onManualPriceChange={setManualPrice}
              aiFailed={aiFailed}
              progress={progress}
              canAdd={canAdd}
              adding={adding}
              parsing={parsing}
              onAdd={() => void handleAdd()}
              onBack={() => { setDraft(null); setMarketplace(null); }}
              onForceClose={handleForceClose}
            />
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
    <PaywallScreen
      visible={paywallVisible}
      onClose={() => setPaywallVisible(false)}
    />
    </>
  );
}

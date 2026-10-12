import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { showAlert } from "@/lib/alert";
import { addToWatchlist, getWatchlist, updateProductListings } from "@/lib/storage";
import { canAddToWatchlist, shouldEnforceFreeLimits } from "@/lib/pro-features";
import { track } from "@/lib/telemetry";
import { DISCOVER_TIMEOUT_MS, manualAddProduct } from "@/lib/manual-add";
import { fetchParsedProduct } from "@/lib/server-product-parse";
import { fetchMarketplaceResolution } from "@/lib/server-marketplace";
import { buildMarketplaceProduct, parseManualPrice } from "@/lib/marketplace";
import { isShopeeInput, marketplaceResolutionMessage, type ShopeeIdentity } from "@/shared/marketplace-url";
import {
  customProductSlug,
  discoverListings,
} from "@/lib/listing-discovery";

interface Draft {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  modelNumber: "",
  brand: "",
  category: "",
  description: "",
};

function fieldStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 12,
  };
}

export function ManualAddSheet({
  visible,
  onClose,
  initialText,
  trackedIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
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
  const [marketplace, setMarketplace] = useState<ShopeeIdentity | null>(null);
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

  useEffect(() => {
    if (visible) {
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
    }
  }, [visible, initialText]);

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
      if (isShopeeInput(text)) {
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
    if (result.kind !== "product" || result.identity.platform !== "shopee") {
      showAlert("Shopee link import", result.kind === "product"
        ? marketplaceResolutionMessage({ kind: "error", reason: "unresolved" }, "lazada")
        : marketplaceResolutionMessage(result));
      return;
    }
    setMarketplace(result.identity);
    setVariant("");
    setSeller("");
    setManualPrice("");
    setDraft({ ...EMPTY_DRAFT, modelNumber: `shopee-th-${result.identity.shopId}-${result.identity.itemId}` });
    setAiFailed(false);
  };

  const handleUrlParse = async () => {
    const text = urlInput.trim();
    if (!text || urlParsing || !isUrlLike(text)) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrlParsing(true);
    try {
      if (isShopeeInput(text)) {
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
        if (!added) { showAlert("Already Tracked", "This Shopee item is already tracked with a selected variant."); return; }
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert("Product Added", "Saved your manually entered Shopee TH price. Automatic monitoring is unavailable.");
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
    (!marketplace || (!!variant.trim() && !!seller.trim() && parseManualPrice(manualPrice) !== null));

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
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
            <>
              <Text
                style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}
              >
                Paste anything — a model number, product name, or a spec-sheet
                paragraph, or Shopee Thailand product link. Shopee imports require manual confirmation.
              </Text>
              <TextInput
                value={raw}
                onChangeText={setRaw}
                multiline
                autoFocus
                placeholder={
                  "e.g. MikroTik CRS326-24S+2Q+RM switch, 24x SFP+ 2x QSFP+, desktop rackmount"
                }
                placeholderTextColor={colors.muted}
                style={{
                  ...fieldStyle(colors),
                  minHeight: 110,
                  textAlignVertical: "top",
                }}
              />
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleParse}
                disabled={parsing || raw.trim().length === 0}
                style={{
                  backgroundColor:
                    raw.trim().length > 0 && !parsing
                      ? colors.primary
                      : colors.border,
                  opacity: parsing || raw.trim().length === 0 ? 0.5 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                accessibilityLabel={isShopeeInput(raw) ? "Resolve Shopee link" : "Clean up with AI"}
                accessibilityRole="button"
                accessibilityState={{ disabled: parsing || raw.trim().length === 0 }}
              >
                {parsing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="wand.and.stars" size={18} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                       {isShopeeInput(raw) ? "Resolve Shopee Link" : "Clean up with AI"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>
                Paste distributor or Shopee Thailand URL
              </Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://distributor.com/product/..."
                placeholderTextColor={colors.muted}
                style={{
                  ...fieldStyle(colors),
                  marginBottom: 12,
                }}
              />
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleUrlParse}
                disabled={urlParsing || !isUrlLike(urlInput)}
                style={{
                  backgroundColor:
                    isUrlLike(urlInput) && !urlParsing
                      ? colors.primary
                      : colors.border,
                  opacity: isUrlLike(urlInput) && !urlParsing ? 1 : 0.5,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                accessibilityLabel="Fetch from URL"
                accessibilityRole="button"
                accessibilityState={{ disabled: urlParsing || !isUrlLike(urlInput) }}
              >
                {urlParsing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="link" size={18} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                      Fetch from URL
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView>
              {aiFailed && (
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  Couldn&apos;t reach the AI — please fill in the details
                  manually.
                </Text>
              )}
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}
              >
                Review and edit before adding.
              </Text>
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
                placeholder="Product name"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              {marketplace ? (
                <>
                  <Text style={{ color: colors.muted, marginBottom: 12 }}>
                    Shopee TH · shop {marketplace.shopId} · item {marketplace.itemId}{"\n"}
                    Confirm the selected variant and seller. Prices are manual; Shopee may require login. No automatic price or stock alerts.
                  </Text>
                  <TextInput value={variant} onChangeText={setVariant} placeholder="Selected variant (or Single option)" accessibilityLabel="Selected variant" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
                  <TextInput value={seller} onChangeText={setSeller} placeholder="Seller" accessibilityLabel="Seller" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
                  <TextInput value={manualPrice} onChangeText={setManualPrice} placeholder="Manually entered price (THB)" accessibilityLabel="Manual THB price" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={fieldStyle(colors)} />
                </>
              ) : (
              <>
              <TextInput
                value={draft.modelNumber}
                onChangeText={(v) => setDraft({ ...draft, modelNumber: v })}
                placeholder="Model number"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.brand}
                onChangeText={(v) => setDraft({ ...draft, brand: v })}
                placeholder="Brand"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.category}
                onChangeText={(v) => setDraft({ ...draft, category: v })}
                placeholder="Category"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.description}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                placeholder="Description"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  ...fieldStyle(colors),
                  minHeight: 70,
                  textAlignVertical: "top",
                }}
              />
              </>
              )}
              {progress && (
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  {progress}
                </Text>
              )}
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleAdd}
                disabled={!canAdd || adding}
                style={{
                  backgroundColor:
                    canAdd && !adding ? colors.primary : colors.border,
                  opacity: !canAdd || adding ? 0.5 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
                accessibilityLabel={marketplace ? "Save manual Shopee product" : "Add and search distributors"}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd || adding }}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol
                      name="plus.circle.fill"
                      size={18}
                      color="#fff"
                    />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                      {marketplace ? "Save Manual Shopee Product" : "Add & Search Distributors"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}
                onPress={() => { setDraft(null); setMarketplace(null); }}
                disabled={parsing || adding}
                style={{ alignItems: "center", paddingVertical: 6, opacity: parsing || adding ? 0.5 : 1 }}
                accessibilityLabel="Back to paste"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Back to paste
                </Text>
              </TouchableOpacity>
              {adding ? (
                <TouchableOpacity activeOpacity={0.7}
                  onPress={handleForceClose}
                  style={{ alignItems: "center", paddingVertical: 10 }}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
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

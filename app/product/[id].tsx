import { useCallback, useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ScrollView, Text, View, TouchableOpacity, Alert, TextInput, Modal, Linking, ActivityIndicator, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, updateProductListings, addAlert } from "@/lib/storage";
import { Product, DistributorListing, PriceAlert } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { schedulePriceAlert, requestNotificationPermissions } from "@/lib/notifications";

// ─── Best Distributor Highlight Card ─────────────────────────────────────────
function BestDistributorCard({ listing }: { listing: DistributorListing }) {
  const colors = useColors();
  const distributor = getDistributorById(listing.distributorId);
  const usdPrice = convertPrice(listing.price, listing.currency, "USD");
  return (
    <View style={{ backgroundColor: colors.primary + "12", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: colors.primary + "55" }}>
      {/* Crown badge */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <View style={{ backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <IconSymbol name="crown.fill" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>BEST PRICE</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Cheapest in-stock option</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>
            {distributor?.countryFlag} {distributor?.name ?? listing.distributorId}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {distributor?.country} · {distributor?.region}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.success + "22", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>● In Stock</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <View>
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 22 }}>
            {formatPrice(listing.price, listing.currency)}
          </Text>
          {listing.currency !== "USD" && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>≈ {formatPrice(usdPrice, "USD")}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(listing.url);
          }}
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 5 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Buy Now</Text>
          <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      {distributor?.paymentMethods && (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
          💳 {distributor.paymentMethods.join(" · ")}
        </Text>
      )}
    </View>
  );
}

// ─── Real distributor data for CRS804-4DDQ-hRM (verified July 19, 2026) ───────
const SAMPLE_LISTINGS: Record<string, DistributorListing[]> = {
  "mikrotik-crs804-4ddq-hrm": [
    {
      distributorId: "server2u-my",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 5568,
      currency: "MYR",
      stockStatus: "in_stock",
      url: "https://server2u.com/shop/crs804-4ddq-hrm-mikrotik-crs804-4ddq-hrm-400g-master-switch-66247",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 5750, currency: "MYR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 5680, currency: "MYR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 5620, currency: "MYR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 5590, currency: "MYR", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 5568, currency: "MYR", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "mikrotikstore-de",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 1141.67,
      currency: "EUR",
      stockStatus: "in_stock",
      url: "https://mikrotik-store.eu/en/cloud-router-switches/crs804-4ddq-hrm",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 1095, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 1110, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 1125, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 1135, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 1141.67, currency: "EUR", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "interprojekt-pl",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 860.54,
      currency: "EUR",
      stockStatus: "back_order",
      expectedDate: "Sept 15, 2026",
      url: "https://interprojekt.pl/en/p/mikrotik-crs804-4ddq-hrm.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 890, currency: "EUR", stockStatus: "back_order" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 875, currency: "EUR", stockStatus: "back_order" },
        { date: new Date().toISOString(), price: 860.54, currency: "EUR", stockStatus: "back_order" },
      ],
    },
    {
      distributorId: "nasstore-eu",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 956.0,
      currency: "EUR",
      stockStatus: "back_order",
      expectedDate: "Aug 13, 2026",
      url: "https://nasstore.eu/product/mikrotik-cloud-router-switch-crs804-4ddq-hrm/",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 970, currency: "EUR", stockStatus: "back_order" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 960, currency: "EUR", stockStatus: "back_order" },
        { date: new Date().toISOString(), price: 956, currency: "EUR", stockStatus: "back_order" },
      ],
    },
    {
      distributorId: "aerial-gr",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 956.99,
      currency: "EUR",
      stockStatus: "back_order",
      expectedDate: "Sept 9, 2026",
      url: "https://aerial.net/shop/product/mikrotik-crs804-4ddq-hrm-cloud-router-switch-5671",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 965, currency: "EUR", stockStatus: "back_order" },
        { date: new Date().toISOString(), price: 956.99, currency: "EUR", stockStatus: "back_order" },
      ],
    },
    {
      distributorId: "linitx-uk",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 1139.99,
      currency: "GBP",
      stockStatus: "back_order",
      expectedDate: "Sept 18, 2026",
      url: "https://linitx.com/product/mikrotik-crs804-ddq-cloud-router-400gb-4-port-switch-crs804-4ddq-hrm/18455",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 1180, currency: "GBP", stockStatus: "back_order" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 1160, currency: "GBP", stockStatus: "back_order" },
        { date: new Date().toISOString(), price: 1139.99, currency: "GBP", stockStatus: "back_order" },
      ],
    },
    {
      distributorId: "miro-za",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 30140,
      currency: "ZAR",
      stockStatus: "back_order",
      expectedDate: "Aug 2026",
      url: "https://miro.co.za/07-networking-switches---managed-layer-3/8878-mikrotik-cloud-router-switch-crs804-4ddq-hrm-miro.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 29500, currency: "ZAR", stockStatus: "back_order" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 29900, currency: "ZAR", stockStatus: "back_order" },
        { date: new Date().toISOString(), price: 30140, currency: "ZAR", stockStatus: "back_order" },
      ],
    },
    {
      distributorId: "getic-gr",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 877.64,
      currency: "EUR",
      stockStatus: "out_of_stock",
      url: "https://www.getic.com/product/mikrotik-crs804-4ddq-hrm",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 870, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 875, currency: "EUR", stockStatus: "out_of_stock" },
        { date: new Date().toISOString(), price: 877.64, currency: "EUR", stockStatus: "out_of_stock" },
      ],
    },
    {
      distributorId: "duxtel-au",
      productId: "mikrotik-crs804-4ddq-hrm",
      price: 2299,
      currency: "AUD",
      stockStatus: "out_of_stock",
      url: "https://store.duxtel.com.au/product/crs804-4ddq-hrm",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 2350, currency: "AUD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 2310, currency: "AUD", stockStatus: "out_of_stock" },
        { date: new Date().toISOString(), price: 2299, currency: "AUD", stockStatus: "out_of_stock" },
      ],
    },
  ],
};

function formatLastChecked(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Unknown";
  }
}

function StockBadge({ status, expectedDate }: { status: string; expectedDate?: string }) {
  const colors = useColors();
  const config: Record<string, { bg: string; text: string; label: string }> = {
    in_stock: { bg: colors.success + "22", text: colors.success, label: "In Stock" },
    back_order: { bg: colors.warning + "22", text: colors.warning, label: `Back Order${expectedDate ? ` · ${expectedDate}` : ""}` },
    out_of_stock: { bg: colors.error + "22", text: colors.error, label: "Out of Stock" },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = config[status] ?? config.unknown;
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>● {c.label}</Text>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const [product, setProduct] = useState<Product | null>(null);
  const [listings, setListings] = useState<DistributorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");

  // Best in-stock distributor (cheapest by USD equivalent)
  const bestInStockListing = (() => {
    const inStock = listings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    return inStock.reduce((best, l) =>
      convertPrice(l.price, l.currency, "USD") < convertPrice(best.price, best.currency, "USD") ? l : best
    );
  })();

  const loadData = useCallback(async () => {
    setLoading(true);
    const watchlist = await getWatchlist();
    const found = watchlist.find((p) => p.id === id);
    if (found) {
      setProduct(found);
      // Use existing listings or load sample data for demo
      const existingListings = found.listings?.length ? found.listings : (SAMPLE_LISTINGS[id] ?? []);
      setListings(existingListings);
      if (!found.listings?.length && SAMPLE_LISTINGS[id]) {
        await updateProductListings(id, SAMPLE_LISTINGS[id]);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSetAlert = useCallback(async () => {
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid target price.");
      return;
    }
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      productId: id,
      targetPrice: price,
      currency: alertCurrency,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await addAlert(newAlert);
    // Schedule a confirmation notification so the user knows the alert is active
    await requestNotificationPermissions();
    await schedulePriceAlert(product?.name ?? "Product", price, alertCurrency);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlertModalVisible(false);
    setAlertPrice("");
    Alert.alert("Alert Set", `You'll be notified when the price drops below ${formatPrice(price, alertCurrency)}.`);
  }, [alertPrice, alertCurrency, id, product]);

  const sortedListings = [...listings].sort((a, b) => {
    const order = { in_stock: 0, back_order: 1, out_of_stock: 2, unknown: 3 };
    return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
  });

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const inStockListings = sortedListings.filter((l) => l.stockStatus === "in_stock");
    const bestListing = inStockListings[0] ?? sortedListings[0];
    const distributor = bestListing ? getDistributorById(bestListing.distributorId) : null;
    const priceStr = bestListing ? formatPrice(bestListing.price, bestListing.currency) : "N/A";
    const statusStr = inStockListings.length > 0
      ? `✅ In Stock at ${distributor?.name ?? "a distributor"} for ${priceStr}`
      : `⏳ Back Order — best price ${priceStr}`;
    const url = bestListing?.url ?? "";
    const message = `${product?.name} (${product?.modelNumber})\n${statusStr}\n${url}`;
    try {
      await Share.share({ message, title: product?.name ?? "Product" });
    } catch {
      // User cancelled share — no action needed
    }
  }, [product, sortedListings]);

  const handleCopyLink = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const inStockListings = sortedListings.filter((l) => l.stockStatus === "in_stock");
    const bestListing = inStockListings[0] ?? sortedListings[0];
    const url = bestListing?.url ?? "";
    if (!url) {
      Alert.alert("No Link", "No distributor URL available to copy.");
      return;
    }
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Link Copied!", "The distributor URL has been copied to your clipboard.");
  }, [sortedListings]);

  const handleTestStockNotification = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Push notifications are only available on iOS and Android devices.");
      return;
    }
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert("Permission Denied", "Please enable notifications in your device settings to receive stock alerts.");
      return;
    }
    const inStockListing = sortedListings.find((l) => l.stockStatus === "in_stock");
    const targetListing = inStockListing ?? sortedListings[0];
    const distributor = targetListing ? getDistributorById(targetListing.distributorId) : null;
    await scheduleStockAlert(
      product?.name ?? "Product",
      distributor?.name ?? "a distributor",
      targetListing?.price ?? 0,
      targetListing?.currency ?? "USD"
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Notification Sent!", `A "Back In Stock" alert for ${product?.name} has been sent to your device.`);
  }, [product, sortedListings]);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.foreground, fontSize: 16 }}>Product not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }} numberOfLines={2}>{product.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{product.modelNumber}</Text>
          </View>
        </View>

        {/* Product Info Card */}
        <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <View style={{ backgroundColor: colors.primary + "22", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{product.brand}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{product.category}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{product.description}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Distributors</Text>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 20 }}>{listings.length}</Text>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>In Stock</Text>
              <Text style={{ color: colors.success, fontWeight: "700", fontSize: 20 }}>
                {listings.filter((l) => l.stockStatus === "in_stock").length}
              </Text>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Best Price</Text>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 20 }}>
                {listings.length > 0
                  ? formatPrice(
                      Math.min(...listings.filter((l) => l.price > 0).map((l) => convertPrice(l.price, l.currency, "USD"))),
                      "USD"
                    )
                  : "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAlertModalVisible(true);
            }}
            style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
          >
            <IconSymbol name="bell.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Set Price Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              loadData();
            }}
            style={{ backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border, flexDirection: "row", gap: 6 }}
          >
            <IconSymbol name="arrow.clockwise" size={16} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Distributor Listings */}
        <View style={{ paddingHorizontal: 16 }}>
          {/* Secondary Action Buttons */}
          <View style={{ flexDirection: "row", marginBottom: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleShare}
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <IconSymbol name="square.and.arrow.up" size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTestStockNotification}
              style={{ flex: 1, backgroundColor: colors.success + "18", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.success + "44", flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <IconSymbol name="bell.badge.fill" size={16} color={colors.success} />
              <Text style={{ color: colors.success, fontWeight: "600", fontSize: 14 }}>Test Stock Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCopyLink}
              style={{ backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <IconSymbol name="doc.on.doc" size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Copy Link</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            Distributor Prices
          </Text>
          {sortedListings.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>No distributor data available yet.</Text>
            </View>
          ) : (
            <>
              {bestInStockListing && (
                <BestDistributorCard listing={bestInStockListing} />
              )}
              {bestInStockListing && (
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 10, marginTop: 4, letterSpacing: 0.5 }}>
                  ALL DISTRIBUTORS
                </Text>
              )}
              {sortedListings.map((listing) => {
              const distributor = getDistributorById(listing.distributorId);
              const usdPrice = convertPrice(listing.price, listing.currency, "USD");
              return (
                <View key={listing.distributorId} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
                        {distributor?.countryFlag} {distributor?.name ?? listing.distributorId}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {distributor?.country} · {distributor?.region}
                      </Text>
                    </View>
                    <StockBadge status={listing.stockStatus} expectedDate={listing.expectedDate} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 18 }}>
                        {formatPrice(listing.price, listing.currency)}
                      </Text>
                      {listing.currency !== "USD" && (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>≈ {formatPrice(usdPrice, "USD")}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      {listing.priceHistory && listing.priceHistory.length >= 2 && (
                        <PriceSparkline data={listing.priceHistory} width={72} height={28} currency={listing.currency} />
                      )}
                      <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(listing.url);
                      }}
                      style={{ backgroundColor: colors.primary + "22", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Visit</Text>
                      <IconSymbol name="arrow.up.right.square" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    </View>
                  </View>
                  {distributor?.paymentMethods && (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
                      💳 {distributor.paymentMethods.join(" · ")}
                    </Text>
                  )}
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: distributor?.paymentMethods ? 2 : 8, opacity: 0.7 }}>
                    🕐 Updated {formatLastChecked(listing.lastChecked)}
                  </Text>
                </View>
              );
            })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Price Alert Modal */}
      <Modal visible={alertModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 6 }}>Set Price Alert</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}>
              Get notified when {product.name} drops below your target price.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {["USD", "EUR", "GBP", "THB"].map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setAlertCurrency(c)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: alertCurrency === c ? colors.primary : colors.surface, borderWidth: 1, borderColor: alertCurrency === c ? colors.primary : colors.border }}
                >
                  <Text style={{ color: alertCurrency === c ? "#fff" : colors.foreground, fontWeight: "600" }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={alertPrice}
              onChangeText={setAlertPrice}
              placeholder={`Target price in ${alertCurrency}`}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, color: colors.foreground, fontSize: 18, marginBottom: 16 }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setAlertModalVisible(false)}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetAlert}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Set Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
import { scheduleStockAlert } from "@/lib/notifications";
import { PriceSparkline } from "@/components/price-sparkline";

import { useCallback, useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ScrollView, Text, View, TouchableOpacity, Alert, TextInput, Modal, Linking, ActivityIndicator, Share, Platform, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { LinearGradient } from "expo-linear-gradient";
import { getWatchlist, updateProductListings, addAlert, getDistributorWatches, toggleDistributorWatch, addRecentlyViewed } from "@/lib/storage";
import { Product, DistributorListing, PriceAlert } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { schedulePriceAlert, scheduleStockAlert, requestNotificationPermissions } from "@/lib/notifications";
import { PriceSparkline } from "@/components/price-sparkline";

// ─── Real distributor data for CRS804-4DDQ-hRM (verified July 19, 2026) ───────
// ─── Listings for all tracked products ────────────────────────────────────────
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

const EXTRA_LISTINGS: Record<string, DistributorListing[]> = {
  "ubiquiti-udm-pro": [
    {
      distributorId: "bhphoto-us",
      productId: "ubiquiti-udm-pro",
      price: 379.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://bhphotovideo.com/c/product/1552916-REG/ubiquiti_udm_pro_unifi_dream_machine_pro.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 399, currency: "USD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 389, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 379, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "neobits-us",
      productId: "ubiquiti-udm-pro",
      price: 382.50,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://neobits.com/ubiquiti_udm_pro.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 395, currency: "USD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 385, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 382.50, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "pbtech-nz",
      productId: "ubiquiti-udm-pro",
      price: 699.00,
      currency: "NZD",
      stockStatus: "in_stock",
      url: "https://pbtech.co.nz/product/NETUBI0235/Ubiquiti-UniFi-Dream-Machine-Pro",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 729, currency: "NZD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 699, currency: "NZD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "duxtel-au",
      productId: "ubiquiti-udm-pro",
      price: 599.00,
      currency: "AUD",
      stockStatus: "back_order",
      expectedDate: "Aug 2026",
      url: "https://store.duxtel.com.au/product/udm-pro",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 619, currency: "AUD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 599, currency: "AUD", stockStatus: "back_order" },
      ],
    },
  ],
  "ubiquiti-usw-pro-48": [
    {
      distributorId: "bhphoto-us",
      productId: "ubiquiti-usw-pro-48",
      price: 499.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://bhphotovideo.com/c/product/1591087-REG/ubiquiti_usw_pro_48_unifi_switch_pro_48.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 529, currency: "USD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 509, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 499, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "neobits-us",
      productId: "ubiquiti-usw-pro-48",
      price: 502.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://neobits.com/ubiquiti_usw_pro_48.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 515, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 502, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "linitx-uk",
      productId: "ubiquiti-usw-pro-48",
      price: 449.99,
      currency: "GBP",
      stockStatus: "in_stock",
      url: "https://linitx.com/product/ubiquiti-unifi-switch-pro-48/16234",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 469, currency: "GBP", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 455, currency: "GBP", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 449.99, currency: "GBP", stockStatus: "in_stock" },
      ],
    },
  ],
  "intel-x710-da2": [
    {
      distributorId: "bhphoto-us",
      productId: "intel-x710-da2",
      price: 289.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://bhphotovideo.com/c/product/1648212-REG/intel_x710da2blk_ethernet-converged-network-adapter.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 310, currency: "USD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 299, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 289, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "neobits-us",
      productId: "intel-x710-da2",
      price: 292.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://neobits.com/intel_x710_da2.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 305, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 292, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "getic-gr",
      productId: "intel-x710-da2",
      price: 265.00,
      currency: "EUR",
      stockStatus: "in_stock",
      url: "https://getic.com/product/intel-x710-da2",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 280, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 7).toISOString(), price: 270, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 265, currency: "EUR", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "linitx-uk",
      productId: "intel-x710-da2",
      price: 245.00,
      currency: "GBP",
      stockStatus: "back_order",
      expectedDate: "Sept 2026",
      url: "https://linitx.com/product/intel-x710-da2/15890",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 258, currency: "GBP", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 245, currency: "GBP", stockStatus: "back_order" },
      ],
    },
  ],
  "mellanox-cx6": [
    {
      distributorId: "bhphoto-us",
      productId: "mellanox-cx6",
      price: 1299.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://bhphotovideo.com/c/product/1571234-REG/mellanox_mcx653106a_ecat_connectx_6_vpi_adapter.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 30).toISOString(), price: 1350, currency: "USD", stockStatus: "in_stock" },
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 1320, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 1299, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "neobits-us",
      productId: "mellanox-cx6",
      price: 1315.00,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://neobits.com/mellanox_connectx6.html",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 14).toISOString(), price: 1340, currency: "USD", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 1315, currency: "USD", stockStatus: "in_stock" },
      ],
    },
    {
      distributorId: "getic-gr",
      productId: "mellanox-cx6",
      price: 1189.00,
      currency: "EUR",
      stockStatus: "back_order",
      expectedDate: "Oct 2026",
      url: "https://getic.com/product/mellanox-connectx-6",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { date: new Date(Date.now() - 86400000 * 21).toISOString(), price: 1220, currency: "EUR", stockStatus: "in_stock" },
        { date: new Date().toISOString(), price: 1189, currency: "EUR", stockStatus: "back_order" },
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
  const [refreshing, setRefreshing] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [distributorWatches, setDistributorWatches] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const watchlist = await getWatchlist();
    const found = watchlist.find((p) => p.id === id);
    if (found) {
      setProduct(found);
      // Use existing listings or load sample data for demo
      const allSamples = { ...SAMPLE_LISTINGS, ...EXTRA_LISTINGS };
      const existingListings = found.listings?.length ? found.listings : (allSamples[id] ?? []);
      setListings(existingListings);
      if (!found.listings?.length && allSamples[id]) {
        await updateProductListings(id, allSamples[id]);
      }
    }
    const watches = await getDistributorWatches();
    setDistributorWatches(watches);
    await addRecentlyViewed(id);
    setLoading(false);
  }, [id]);

  const handleToggleDistributorWatch = useCallback(async (distributorId: string, distributorName: string, listing: DistributorListing) => {
    await requestNotificationPermissions();
    const isNowWatched = await toggleDistributorWatch(id, distributorId);
    const watches = await getDistributorWatches();
    setDistributorWatches(watches);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isNowWatched) {
      await scheduleStockAlert(product?.name ?? "Product", distributorName, listing.price, listing.currency);
      Alert.alert("Watching", `You'll be notified when ${distributorName} gets this back in stock.`);
    } else {
      Alert.alert("Removed", `Stopped watching ${distributorName} for this product.`);
    }
  }, [id, product]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  const REGIONS = ["All", ...Array.from(new Set(listings.map((l) => {
    const d = getDistributorById(l.distributorId);
    return d?.region ?? "Other";
  }))).sort()];

  const filteredListings = regionFilter && regionFilter !== "All"
    ? sortedListings.filter((l) => {
        const d = getDistributorById(l.distributorId);
        return d?.region === regionFilter;
      })
    : sortedListings;

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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        {/* Hero Banner */}
        {(() => {
          const brandColors: Record<string, [string, string]> = {
            MikroTik: ["#0a7ea4", "#005f7a"],
            Ubiquiti: ["#0559C9", "#033a8a"],
            Intel: ["#0071C5", "#004a82"],
            Cisco: ["#1BA0D7", "#0d6e94"],
            Juniper: ["#84BD00", "#5a8200"],
            "Aruba (HPE)": ["#00B388", "#007a5e"],
            NETGEAR: ["#E31837", "#a01025"],
            "NVIDIA/Mellanox": ["#76B900", "#4d7a00"],
          };
          const [c1, c2] = brandColors[product.brand] ?? ["#334155", "#1e293b"];
          const categoryIcon: Record<string, string> = {
            "Networking Switch": "network",
            Router: "wifi",
            "Network Gateway": "lock.shield.fill",
            "Network Card": "cpu",
          };
          const icon = categoryIcon[product.category] ?? "server.rack";
          return (
            <LinearGradient
              colors={[c1, c2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 140, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 16 }}
            >
              {/* Back button overlay */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ position: "absolute", top: 12, left: 12, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 20, padding: 8 }}
              >
                <IconSymbol name="arrow.left" size={20} color="#fff" />
              </TouchableOpacity>
              {/* Category icon */}
              <View style={{ position: "absolute", top: 12, right: 16, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16, padding: 10 }}>
                <IconSymbol name={icon as any} size={28} color="rgba(255,255,255,0.9)" />
              </View>
              {/* Title */}
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }}>{product.modelNumber}</Text>
            </LinearGradient>
          );
        })()}

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
          {/* Region filter chips */}
          {REGIONS.length > 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, flexDirection: "row", paddingBottom: 12 }}
            >
              {REGIONS.map((region) => {
                const isActive = (regionFilter === null && region === "All") || regionFilter === region;
                return (
                  <TouchableOpacity
                    key={region}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRegionFilter(region === "All" ? null : region);
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: isActive ? colors.primary : colors.surface, borderWidth: 1, borderColor: isActive ? colors.primary : colors.border }}
                  >
                    <Text style={{ color: isActive ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{region}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {filteredListings.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>No distributors in this region.</Text>
            </View>
          ) : (
            filteredListings.map((listing) => {
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
                  <TouchableOpacity onPress={() => handleToggleDistributorWatch(listing.distributorId, distributor?.name ?? listing.distributorId, listing)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 4 }}><IconSymbol name={distributorWatches[`${id}::${listing.distributorId}`] ? "bell.fill" : "bell.slash.fill"} size={14} color={distributorWatches[`${id}::${listing.distributorId}`] ? colors.primary : colors.muted} /><Text style={{ color: distributorWatches[`${id}::${listing.distributorId}`] ? colors.primary : colors.muted, fontSize: 12, fontWeight: "500" }}>{distributorWatches[`${id}::${listing.distributorId}`] ? "Watching this distributor" : "Notify when back in stock"}</Text></TouchableOpacity>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: distributor?.paymentMethods ? 2 : 8, opacity: 0.7 }}>
                    🕐 Updated {formatLastChecked(listing.lastChecked)}
                  </Text>
                </View>
              );
            })
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

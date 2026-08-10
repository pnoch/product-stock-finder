import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getWatchlist,
  getSettings,
  removeFromWatchlist,
  refreshWatchlistPrices,
} from "@/lib/storage";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { Product } from "@/lib/types";
import { formatPrice, getBestPrice, convertPrice } from "@/lib/currency";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { getAllRegions, productHasRegion } from "@/lib/region-filter";

type SortMode = "recent" | "best_price" | "az";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "best_price", label: "Best Price" },
  { key: "az", label: "A–Z" },
];

function sortWatchlist(list: Product[], mode: SortMode): Product[] {
  const copy = [...list];
  if (mode === "recent") {
    return copy.sort(
      (a, b) =>
        new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime(),
    );
  }
  if (mode === "az") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (mode === "best_price") {
    return copy.sort((a, b) => {
      const pa = getBestPrice(a.listings ?? [], "USD")?.price ?? Infinity;
      const pb = getBestPrice(b.listings ?? [], "USD")?.price ?? Infinity;
      return pa - pb;
    });
  }
  return copy;
}

function StockBadge({ status }: { status: string }) {
  const colors = useColors();
  const config: Record<string, { bg: string; text: string; label: string }> = {
    in_stock: {
      bg: colors.success + "22",
      text: colors.success,
      label: "In Stock",
    },
    back_order: {
      bg: colors.warning + "22",
      text: colors.warning,
      label: "Back Order",
    },
    out_of_stock: {
      bg: colors.error + "22",
      text: colors.error,
      label: "Out of Stock",
    },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = config[status] ?? config.unknown;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>
        ● {c.label}
      </Text>
    </View>
  );
}

function ProductCard({
  product,
  onPress,
  onDelete,
}: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const bestPrice = getBestPrice(product.listings ?? [], "USD");
  const bestStatus =
    product.listings?.find((l) => l.stockStatus === "in_stock")?.stockStatus ??
    product.listings?.find((l) => l.stockStatus === "back_order")
      ?.stockStatus ??
    "out_of_stock";
  const distributorCount = product.listings?.length ?? 0;

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      onPress={onPress}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 15,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            {product.modelNumber}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
            {product.brand} · {product.category}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StockBadge status={bestStatus} />
          {bestPrice && (
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
            >
              {formatPrice(bestPrice.price, bestPrice.currency)}
            </Text>
          )}
          {(() => {
            if (!bestPrice) return null;
            const allHistory = (product.listings ?? []).flatMap(
              (l) => l.priceHistory ?? [],
            );
            if (allHistory.length < 2) return null;
            const sorted = [...allHistory].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
            // Normalize to USD for fair comparison across distributors/currencies
            const oldestUsd = convertPrice(
              sorted[0].price,
              sorted[0].currency,
              "USD",
            );
            const currentUsd = bestPrice.price;
            if (oldestUsd <= 0) return null;
            const pct = ((currentUsd - oldestUsd) / oldestUsd) * 100;
            if (Math.abs(pct) < 0.5) return null;
            const isDown = pct < 0;
            return (
              <Text
                style={{
                  color: isDown ? colors.success : colors.error,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {isDown ? "▼" : "▲"} {Math.abs(pct).toFixed(1)}%
              </Text>
            );
          })()}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {distributorCount} distributor{distributorCount !== 1 ? "s" : ""}{" "}
          tracked
        </Text>
        {(() => {
          const refreshColor = getLastRefreshedColor(product.lastRefreshed);
          const colorMap = {
            green: colors.success,
            yellow: colors.warning,
            red: colors.error,
            gray: colors.muted,
          };
          return (
            <Text style={{ color: colorMap[refreshColor], fontSize: 11 }}>
              Updated {formatLastRefreshed(product.lastRefreshed)}
            </Text>
          );
        })()}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol name="trash.fill" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function WatchlistScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);

  const loadData = useCallback(async () => {
    const list = await getWatchlist();
    setWatchlist(list);
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredWatchlist = useMemo(
    () =>
      regionFilter === "all"
        ? watchlist
        : watchlist.filter((p) => productHasRegion(p, regionFilter)),
    [watchlist, regionFilter],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(filteredWatchlist, displayCurrency),
    [filteredWatchlist, displayCurrency],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshWatchlistPrices();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = useCallback(
    (productId: string, productName: string) => {
      Alert.alert(
        "Remove Product",
        `Remove "${productName}" from your watchlist?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              await removeFromWatchlist(productId);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleCheckNow = useCallback(async () => {
    if (checking || watchlist.length === 0) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecking(true);
    setCheckProgress({ current: 0, total: watchlist.length });
    try {
      await checkPriceDropsNow((current, total) => {
        setCheckProgress({ current, total });
      });
      await loadData();
    } finally {
      setChecking(false);
      setCheckProgress(null);
    }
  }, [checking, watchlist.length, loadData]);

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
          <Text className="text-muted text-sm">
            {filteredWatchlist.length} product{filteredWatchlist.length !== 1 ? "s" : ""}{" "}
            tracked
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push("/distributor-analysis")}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="chart.bar.xaxis" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
              Analysis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: checking ? colors.muted : colors.primary,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: watchlist.length === 0 ? 0.5 : 1,
            }}
            onPress={handleCheckNow}
            disabled={checking || watchlist.length === 0}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol name="arrow.clockwise" size={16} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              {checkProgress
                ? `Checking ${checkProgress.current}/${checkProgress.total}`
                : "Check Now"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/search");
            }}
          >
            <IconSymbol name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {watchlist.length > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Total Value</Text>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>
              {formatPrice(summary.totalValue, displayCurrency)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 12, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>{summary.inStock}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>In Stock</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.warning, fontSize: 16, fontWeight: "600" }}>{summary.backOrder}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Back Order</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.error, fontSize: 16, fontWeight: "600" }}>{summary.outOfStock}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Out of Stock</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>{summary.listingCount}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Listings</Text>
            </View>
          </View>
        </View>
      )}

      {checking && checkProgress && (
        <View className="h-1 mx-4 mb-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.primary + "20" }}>
          <View
            className="h-full rounded-full"
            style={{
              width: `${(checkProgress.current / checkProgress.total) * 100}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      )}

      {/* Sort Bar */}
      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 20,
            paddingBottom: 10,
            gap: 8,
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(opt.key);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor:
                  sortMode === opt.key ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor:
                  sortMode === opt.key ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color: sortMode === opt.key ? "#fff" : colors.muted,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {["all", ...regions].map((region) => (
            <TouchableOpacity
              key={region}
              onPress={() => setRegionFilter(region)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor:
                  regionFilter === region ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: regionFilter === region ? "#fff" : colors.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {region === "all" ? "All" : region}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={sortWatchlist(filteredWatchlist, sortMode)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
            }}
          >
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 18,
                marginTop: 16,
              }}
            >
              {regionFilter !== "all" ? "No products in this region" : "No products yet"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {regionFilter !== "all"
                ? `No tracked products have distributors in ${regionFilter}`
                : "Add products to track their availability and prices globally"}
            </Text>
            {regionFilter !== "all" ? (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => setRegionFilter("all")}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Show All
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
            onDelete={() => handleDelete(item.id, item.name)}
          />
        )}
      />
    </ScreenContainer>
  );
}

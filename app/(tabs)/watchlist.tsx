import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, removeFromWatchlist } from "@/lib/storage";
import { refreshWatchlistPrices } from "@/lib/storage";
import { Product } from "@/lib/types";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

type SortMode = "recent" | "best_price" | "az";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "best_price", label: "Best Price" },
  { key: "az", label: "A–Z" },
];

function sortWatchlist(list: Product[], mode: SortMode): Product[] {
  const copy = [...list];
  if (mode === "recent") {
    return copy.sort((a, b) => new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime());
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
    in_stock: { bg: colors.success + "22", text: colors.success, label: "In Stock" },
    back_order: { bg: colors.warning + "22", text: colors.warning, label: "Back Order" },
    out_of_stock: { bg: colors.error + "22", text: colors.error, label: "Out of Stock" },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = config[status] ?? config.unknown;
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>● {c.label}</Text>
    </View>
  );
}

function ProductCard({ product, onPress, onDelete }: { product: Product; onPress: () => void; onDelete: () => void }) {
  const colors = useColors();
  const bestPrice = getBestPrice(product.listings ?? [], "USD");
  const bestStatus = product.listings?.find((l) => l.stockStatus === "in_stock")?.stockStatus
    ?? product.listings?.find((l) => l.stockStatus === "back_order")?.stockStatus
    ?? "out_of_stock";
  const distributorCount = product.listings?.length ?? 0;

  return (
    <TouchableOpacity
      style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }} numberOfLines={2}>{product.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{product.modelNumber}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{product.brand} · {product.category}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StockBadge status={bestStatus} />
          {bestPrice && (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>
              {formatPrice(bestPrice.price, bestPrice.currency)}
            </Text>
          )}
          {(() => {
            const allHistory = (product.listings ?? []).flatMap((l) => l.priceHistory ?? []);
            if (allHistory.length < 2) return null;
            const sorted = [...allHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const oldest = sorted[0].price;
            const current = bestPrice?.price ?? oldest;
            const pct = ((current - oldest) / oldest) * 100;
            if (Math.abs(pct) < 0.5) return null;
            const isDown = pct < 0;
            return (
              <Text style={{ color: isDown ? "#22C55E" : "#EF4444", fontSize: 11, fontWeight: "600" }}>
                {isDown ? "▼" : "▲"} {Math.abs(pct).toFixed(1)}%
              </Text>
            );
          })()}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {distributorCount} distributor{distributorCount !== 1 ? "s" : ""} tracked
        </Text>
        {product.lastRefreshed && (
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {(() => {
              const diffMs = Date.now() - new Date(product.lastRefreshed!).getTime();
              const diffMin = Math.floor(diffMs / 60000);
              if (diffMin < 1) return "Updated just now";
              if (diffMin < 60) return `Updated ${diffMin}m ago`;
              const diffH = Math.floor(diffMin / 60);
              if (diffH < 24) return `Updated ${diffH}h ago`;
              return `Updated ${Math.floor(diffH / 24)}d ago`;
            })()}
          </Text>
        )}
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

  const loadData = useCallback(async () => {
    const list = await getWatchlist();
    setWatchlist(list);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshWatchlistPrices();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = useCallback((productId: string, productName: string) => {
    Alert.alert(
      "Remove Product",
      `Remove "${productName}" from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await removeFromWatchlist(productId);
            await loadData();
          },
        },
      ]
    );
  }, [loadData]);

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
          <Text className="text-muted text-sm">{watchlist.length} product{watchlist.length !== 1 ? "s" : ""} tracked</Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/search" as any);
          }}
        >
          <IconSymbol name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Sort Bar */}
      {watchlist.length > 0 && (
        <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingBottom: 10, gap: 8 }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(opt.key);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: sortMode === opt.key ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: sortMode === opt.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: sortMode === opt.key ? "#fff" : colors.muted, fontWeight: "600", fontSize: 13 }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={sortWatchlist(watchlist, sortMode)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 18, marginTop: 16 }}>No products yet</Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
              Add products to track their availability and prices globally
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search" as any);
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Add Product</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}` as any)}
            onDelete={() => handleDelete(item.id, item.name)}
          />
        )}
      />
    </ScreenContainer>
  );
}

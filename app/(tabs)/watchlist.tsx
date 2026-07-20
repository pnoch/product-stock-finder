import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Animated } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, removeFromWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";

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

function ProductCard({ product, onPress, onDelete, selected, onToggleSelect, compareMode }: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  compareMode?: boolean;
}) {
  const colors = useColors();
  const bestPrice = getBestPrice(product.listings ?? [], "USD");
  const bestStatus = product.listings?.find((l) => l.stockStatus === "in_stock")?.stockStatus
    ?? product.listings?.find((l) => l.stockStatus === "back_order")?.stockStatus
    ?? "out_of_stock";
  const distributorCount = product.listings?.length ?? 0;

  return (
    <Swipeable
      enabled={!compareMode}
      renderRightActions={(_progress, dragX) => {
        const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: "clamp" });
        return (
          <TouchableOpacity
            onPress={onDelete}
            style={{ backgroundColor: colors.error, borderRadius: 16, marginBottom: 12, width: 72, alignItems: "center", justifyContent: "center" }}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <IconSymbol name="trash.fill" size={20} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        );
      }}
      onSwipeableOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDelete();
      }}
    >
      <TouchableOpacity
      style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: compareMode && selected ? colors.primary : colors.border, opacity: compareMode && !selected ? 0.7 : 1 }}
      onPress={compareMode ? onToggleSelect : onPress}
    >
      {compareMode && (
        <View style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, alignItems: "center", justifyContent: "center" }}>
          {selected && <IconSymbol name="checkmark" size={12} color="#fff" />}
        </View>
      )}
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
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {distributorCount} distributor{distributorCount !== 1 ? "s" : ""} tracked
        </Text>
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
    </Swipeable>
  );
}

export default function WatchlistScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<"best_price" | "alphabetical" | "recently_added">("recently_added");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const list = await getWatchlist();
    setWatchlist(list);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    if (sortMode === "alphabetical") return a.name.localeCompare(b.name);
    if (sortMode === "best_price") {
      const pa = a.listings?.find((l) => l.stockStatus === "in_stock")?.price ?? Infinity;
      const pb = b.listings?.find((l) => l.stockStatus === "in_stock")?.price ?? Infinity;
      return pa - pb;
    }
    // recently_added: preserve original order (most recent first from storage)
    return 0;
  });

  const SORT_OPTIONS: { key: typeof sortMode; label: string }[] = [
    { key: "recently_added", label: "Recent" },
    { key: "best_price", label: "Best Price" },
    { key: "alphabetical", label: "A–Z" },
  ];

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

  const toggleSelect = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedIds.length < 2) {
      Alert.alert("Select Products", "Please select 2 or 3 products to compare.");
      return;
    }
    router.push(`/compare?ids=${selectedIds.join(",")}` as any);
  }, [selectedIds, router]);

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
          <Text className="text-muted text-sm">{watchlist.length} product{watchlist.length !== 1 ? "s" : ""} tracked</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {watchlist.length >= 2 && (
            <TouchableOpacity
              style={{ backgroundColor: compareMode ? colors.primary : colors.surface, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: compareMode ? colors.primary : colors.border }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCompareMode((v) => !v);
                setSelectedIds([]);
              }}
            >
              <IconSymbol name="arrow.left.arrow.right" size={18} color={compareMode ? "#fff" : colors.foreground} />
            </TouchableOpacity>
          )}
          {!compareMode && (
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search" as any);
              }}
            >
              <IconSymbol name="plus" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Compare mode banner */}
      {compareMode && (
        <View style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: colors.primary + "18", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.primary + "44" }}>
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
            {selectedIds.length === 0 ? "Select 2–3 products to compare" : `${selectedIds.length} selected`}
          </Text>
          <TouchableOpacity
            onPress={handleCompare}
            disabled={selectedIds.length < 2}
            style={{ backgroundColor: selectedIds.length >= 2 ? colors.primary : colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Compare</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sort bar */}
      {watchlist.length > 1 && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 10 }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(opt.key);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: sortMode === opt.key ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: sortMode === opt.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: sortMode === opt.key ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={sortedWatchlist}
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
            compareMode={compareMode}
            selected={selectedIds.includes(item.id)}
            onToggleSelect={() => toggleSelect(item.id)}
          />
        )}
      />
    </ScreenContainer>
  );
}

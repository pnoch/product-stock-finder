import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist } from "@/lib/storage";
import { Product, DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice, getBestPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

function StockBadge({ status }: { status: string }) {
  const colors = useColors();
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    in_stock: { bg: colors.success + "22", text: colors.success, label: "In Stock" },
    back_order: { bg: colors.warning + "22", text: colors.warning, label: "Back Order" },
    out_of_stock: { bg: colors.error + "22", text: colors.error, label: "Out of Stock" },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = cfg[status] ?? cfg.unknown;
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>● {c.label}</Text>
    </View>
  );
}

function CompareCell({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, padding: 12, borderRightWidth: 0.5, borderRightColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{label}</Text>
      {children}
    </View>
  );
}

function CompareRow({ label, products, getValue }: {
  label: string;
  products: Product[];
  getValue: (p: Product) => React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
      <View style={{ width: 90, padding: 12, justifyContent: "center", backgroundColor: colors.surface }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      </View>
      {products.map((p) => (
        <CompareCell key={p.id} label="">
          {getValue(p)}
        </CompareCell>
      ))}
    </View>
  );
}

export default function CompareScreen() {
  const router = useRouter();
  const colors = useColors();
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const productIds = (ids ?? "").split(",").filter(Boolean);

  const loadData = useCallback(async () => {
    setLoading(true);
    const watchlist = await getWatchlist();
    const selected = productIds.map((id) => watchlist.find((p) => p.id === id)).filter(Boolean) as Product[];
    setProducts(selected);
    setLoading(false);
  }, [ids]);

  useEffect(() => { loadData(); }, [loadData]);

  const getBestStatus = (p: Product) =>
    p.listings?.find((l) => l.stockStatus === "in_stock")?.stockStatus
    ?? p.listings?.find((l) => l.stockStatus === "back_order")?.stockStatus
    ?? "out_of_stock";

  const getInStockCount = (p: Product) => p.listings?.filter((l) => l.stockStatus === "in_stock").length ?? 0;

  const getLowestPrice = (p: Product) => {
    const inStock = p.listings?.filter((l) => l.stockStatus === "in_stock" && l.price > 0) ?? [];
    if (inStock.length === 0) return null;
    const best = inStock.reduce((min, l) => {
      const usd = convertPrice(l.price, l.currency, "USD");
      return usd < convertPrice(min.price, min.currency, "USD") ? l : min;
    }, inStock[0]);
    return best;
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Compare Products</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Product name headers */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ width: 90, backgroundColor: colors.surface, padding: 12 }} />
          {products.map((p) => (
            <View key={p.id} style={{ flex: 1, padding: 12, backgroundColor: colors.surface, borderRightWidth: 0.5, borderRightColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }} numberOfLines={3}>{p.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{p.modelNumber}</Text>
            </View>
          ))}
        </View>

        {/* Comparison rows */}
        <CompareRow label="Status" products={products} getValue={(p) => <StockBadge status={getBestStatus(p)} />} />
        <CompareRow label="Best Price" products={products} getValue={(p) => {
          const best = getLowestPrice(p);
          return best
            ? <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>{formatPrice(best.price, best.currency)}</Text>
            : <Text style={{ color: colors.muted, fontSize: 13 }}>N/A</Text>;
        }} />
        <CompareRow label="In Stock" products={products} getValue={(p) => (
          <Text style={{ color: getInStockCount(p) > 0 ? colors.success : colors.muted, fontWeight: "700", fontSize: 18 }}>
            {getInStockCount(p)}
          </Text>
        )} />
        <CompareRow label="Distributors" products={products} getValue={(p) => (
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18 }}>{p.listings?.length ?? 0}</Text>
        )} />
        <CompareRow label="Brand" products={products} getValue={(p) => (
          <Text style={{ color: colors.foreground, fontSize: 13 }}>{p.brand}</Text>
        )} />
        <CompareRow label="Category" products={products} getValue={(p) => (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{p.category}</Text>
        )} />

        {/* Best distributor per product */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>Best In-Stock Distributor</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {products.map((p) => {
              const best = getLowestPrice(p);
              if (!best) {
                return (
                  <View key={p.id} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>No in-stock option</Text>
                  </View>
                );
              }
              return (
                <View key={p.id} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.success + "44" }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{p.name.split(" ").slice(-2).join(" ")}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16, marginTop: 4 }}>{formatPrice(best.price, best.currency)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{best.distributorId.replace(/-/g, " ")}</Text>
                  <StockBadge status="in_stock" />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

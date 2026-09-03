import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View, TouchableOpacity, Platform, Share } from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { addToWatchlist } from "@/lib/storage";
import { productHistoryToCsv, watchlistToDetailedCsv } from "@/lib/csv";
import type { Product } from "@/lib/types";

export default function SharedWatchlistScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const colors = useColors();
  const query = trpc.sharedWatchlists.get.useQuery(
    { token: token ?? "" },
    { enabled: !!token },
  );

  if (query.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.error, fontWeight: "700", fontSize: 16 }}>Share not found</Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>{query.error.message}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const data = query.data as unknown as { title: string; token: string; products: unknown[]; createdAt: string | null; expiresAt: string | null } | undefined;
  const rawProducts = (data?.products ?? []) as unknown as Product[];
  const products = rawProducts as Array<{ id: string; name: string; brand?: string; modelNumber?: string; category?: string; listings?: Array<{ distributorId: string; price: number; currency: string; stockStatus: string; url?: string; priceHistory?: import("@/lib/types").PricePoint[] }> }>;
  const createdLabel = data?.createdAt ? formatLastRefreshed(data.createdAt) : null;
  const expiresLabel = data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : null;

  const handleBulkAdd = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    for (const p of rawProducts) {
      try { await addToWatchlist(p as Product); } catch {}
    }
  };

  const handleExportDetailedCsv = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const csv = watchlistToDetailedCsv(rawProducts as Product[]);
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `shared-${token ?? "watchlist"}.csv`; a.click(); URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: csv, title: data?.title ?? "Shared Watchlist" });
    }
  };

  const handleExportHistoryCsv = async (product: Product) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const csv = productHistoryToCsv(product);
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${product.modelNumber ?? product.id}-history.csv`; a.click(); URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: csv, title: `${product.name} history` });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>{data?.title ?? "Shared Watchlist"}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{products.length} products</Text>
        {createdLabel && <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>Last shared: {createdLabel}</Text>}
        {expiresLabel && <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>Expires: {expiresLabel} (30d TTL)</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={handleBulkAdd} style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel="Add all to watchlist" accessibilityRole="button">
            <IconSymbol name="plus" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Add all to Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={handleExportDetailedCsv} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel="Export detailed CSV" accessibilityRole="button">
            <IconSymbol name="square.and.arrow.up" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Export CSV</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, gap: 12 }}>
          {products.map((product) => {
            const best = getBestPrice((product.listings ?? []) as never[], "USD");
            return (
              <View
                key={product.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>{product.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {product.brand ?? ""} {product.modelNumber ?? ""} {product.category ? `· ${product.category}` : ""}
                    </Text>
                  </View>
                  {best && <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{formatPrice(best.price, best.currency)}</Text>}
                </View>
                {(product.listings ?? []).length > 0 ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {(product.listings ?? []).slice(0, 5).map((l) => {
                      const dist = getDistributorById(l.distributorId);
                      return (
                        <View key={l.distributorId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }} numberOfLines={1}>{dist ? `${dist.countryFlag} ${dist.name}` : l.distributorId}</Text>
                          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>{formatPrice(l.price, l.currency)}</Text>
                          <StockBadge status={l.stockStatus} />
                        </View>
                      );
                    })}
                    {(product.listings ?? []).length > 5 && <Text style={{ color: colors.muted, fontSize: 11 }}>+{(product.listings ?? []).length - 5} more distributors</Text>}
                  </View>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>No distributor prices yet</Text>
                )}
                <TouchableOpacity activeOpacity={0.7} onPress={() => handleExportHistoryCsv(product as unknown as Product)} style={{ marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }} accessibilityLabel={`Export history for ${product.name}`} accessibilityRole="button">
                  <IconSymbol name="square.and.arrow.up" size={12} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Export History (CSV)</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

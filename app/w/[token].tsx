import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { getDistributorById } from "@/lib/distributors";

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
  const products = (data?.products ?? []) as Array<{ id: string; name: string; brand?: string; modelNumber?: string; category?: string; listings?: Array<{ distributorId: string; price: number; currency: string; stockStatus: string; url?: string }> }>;
  const createdLabel = data?.createdAt ? formatLastRefreshed(data.createdAt) : null;
  const expiresLabel = data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : null;
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>{data?.title ?? "Shared Watchlist"}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{products.length} products</Text>
        {createdLabel && <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>Last shared: {createdLabel}</Text>}
        {expiresLabel && <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>Expires: {expiresLabel} (30d TTL)</Text>}
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
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

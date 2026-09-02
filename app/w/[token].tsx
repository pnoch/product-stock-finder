import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

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

  const data = query.data;
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>{data?.title ?? "Shared Watchlist"}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>{(data?.products?.length ?? 0)} products</Text>
        <View style={{ marginTop: 16, gap: 12 }}>
          {(data?.products ?? []).map((p: unknown) => {
            const product = p as { id: string; name: string; brand?: string; modelNumber?: string };
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
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{product.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {product.brand ?? ""} {product.modelNumber ?? ""}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

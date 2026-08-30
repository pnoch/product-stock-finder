import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending } from "@/lib/trending";
import { useColors } from "@/hooks/use-colors";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { useRouter } from "expo-router";

export function TrendingSection() {
  const colors = useColors();
  const router = useRouter();
  const { data: products, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const [watchlistIds, setWatchlistIds] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    getWatchlist().then((w) =>
      setWatchlistIds(new Set(w.map((p) => p.id))),
    );
  }, []);

  const handleAdd = async (product: TrendingProduct) => {
    await addToWatchlist({
      id: product.id,
      name: product.name,
      modelNumber: product.id,
      brand: product.brand,
      category: product.category,
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    });
    setWatchlistIds((prev) => new Set([...prev, product.id]));
  };

  if (isLoading || !products || products.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: colors.foreground,
          marginBottom: 4,
        }}
      >
        🔥 Trending Now
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
        Hard-to-find products from the community
      </Text>
      {products.slice(0, 3).map((product) => (
        <TouchableOpacity
          key={product.id}
          onPress={() => router.push(`/product/${product.id}`)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityLabel={`View ${product.name}`}
          accessibilityRole="button"
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                {product.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                }}
              >
                {product.category} · {product.brand} ·{" "}
                {product.currency === "USD"
                  ? "$"
                  : product.currency === "EUR"
                    ? "€"
                    : product.currency === "GBP"
                      ? "£"
                      : product.currency + " "}
                {product.estimatedPrice.toLocaleString()}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 4,
                  fontStyle: "italic",
                }}
              >
                {product.reason}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleAdd(product)}
              disabled={watchlistIds.has(product.id)}
              style={{
                backgroundColor: watchlistIds.has(product.id)
                  ? colors.muted
                  : colors.primary,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginLeft: 8,
              }}
              accessibilityLabel={watchlistIds.has(product.id) ? "Already in watchlist" : "Add to watchlist"}
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {watchlistIds.has(product.id) ? "In Watchlist" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

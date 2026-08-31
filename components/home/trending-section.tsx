import React, { memo, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending } from "@/lib/trending";
import { useColors } from "@/hooks/use-colors";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { useRouter } from "expo-router";
import { fetchProductImage } from "@/lib/server-images";

const TrendingProductRow = memo(function TrendingProductRow({
  product,
  imageUrl,
  isInWatchlist,
  onAdd,
  onPress,
}: {
  product: TrendingProduct;
  imageUrl?: string;
  isInWatchlist: boolean;
  onAdd: (p: TrendingProduct) => void;
  onPress: (id: string) => void;
}) {
  const colors = useColors();
  const handlePress = useCallback(() => onPress(product.id), [onPress, product.id]);
  const handleAddPress = useCallback(
    (e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      onAdd(product);
    },
    [onAdd, product],
  );
  return (
    <TouchableOpacity
      onPress={handlePress}
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
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              marginRight: 12,
            }}
          />
        )}
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
          onPress={handleAddPress}
          disabled={isInWatchlist}
          style={{
            backgroundColor: isInWatchlist ? colors.muted : colors.primary,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginLeft: 8,
          }}
          accessibilityLabel={isInWatchlist ? "Already in watchlist" : "Add to watchlist"}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {isInWatchlist ? "In Watchlist" : "Add"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});
TrendingProductRow.displayName = "TrendingProductRow";

export const TrendingSection = memo(function TrendingSection() {
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
  const [imageUrls, setImageUrls] = React.useState<Map<string, string>>(
    new Map(),
  );

  React.useEffect(() => {
    getWatchlist().then((w) =>
      setWatchlistIds(new Set(w.map((p) => p.id))),
    );
  }, []);

  React.useEffect(() => {
    if (!products) return;
    let active = true;
    const load = async () => {
      const entries = await Promise.all(
        products.slice(0, 3).map(async (p) => {
          const res = await fetchProductImage(p.id);
          return [p.id, res?.imageUrl ?? ""] as const;
        }),
      );
      if (active) {
        setImageUrls(new Map(entries.filter(([, url]) => url)));
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [products]);

  const handleAdd = useCallback(async (product: TrendingProduct) => {
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
  }, []);

  const handlePress = useCallback(
    (id: string) => router.push(`/product/${id}`),
    [router],
  );

  const visibleProducts = useMemo(() => products?.slice(0, 3) ?? [], [products]);

  if (isLoading) return <ActivityIndicator style={{ marginVertical: 16 }} />;
  if (!products || products.length === 0) return null;

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
      {visibleProducts.map((product) => (
        <TrendingProductRow
          key={product.id}
          product={product}
          imageUrl={imageUrls.get(product.id)}
          isInWatchlist={watchlistIds.has(product.id)}
          onAdd={handleAdd}
          onPress={handlePress}
        />
      ))}
    </View>
  );
});
TrendingSection.displayName = "TrendingSection";

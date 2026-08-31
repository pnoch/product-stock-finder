import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending } from "@/lib/trending";
import { useColors } from "@/hooks/use-colors";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { useRouter } from "expo-router";
import { fetchProductImage } from "@/lib/server-images";

function TrendingSkeletonCard() {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View style={{ opacity, backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 14, borderRadius: 6, backgroundColor: colors.border, width: "68%" }} />
          <View style={{ height: 11, borderRadius: 6, backgroundColor: colors.border, width: "42%" }} />
          <View style={{ height: 11, borderRadius: 6, backgroundColor: colors.border, width: "52%" }} />
        </View>
        <View style={{ width: 54, height: 28, borderRadius: 8, backgroundColor: colors.border }} />
      </View>
    </Animated.View>
  );
}

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
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onAdd(product);
    },
    [onAdd, product],
  );
  return (
    <TouchableOpacity activeOpacity={0.7}
      onPress={handlePress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
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
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            onError={() => {}}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              marginRight: 12,
              backgroundColor: colors.border,
            }}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              marginRight: 12,
              backgroundColor: colors.border + "66",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 9, color: colors.muted }}>No img</Text>
          </View>
        )}
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.foreground,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {product.name}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
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
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {product.reason}
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.85}
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
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  const entryAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    if (!visibleProducts.length) return;
    entryAnims.forEach((a) => a.setValue(0));
    Animated.stagger(
      100,
      entryAnims.slice(0, visibleProducts.length).map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
      ),
    ).start();
  }, [visibleProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
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
        <TrendingSkeletonCard />
        <TrendingSkeletonCard />
        <TrendingSkeletonCard />
      </View>
    );
  }
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
      {visibleProducts.map((product, idx) => (
        <Animated.View
          key={product.id}
          style={{
            opacity: entryAnims[idx],
            transform: [
              {
                translateY: entryAnims[idx].interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <TrendingProductRow
            product={product}
            imageUrl={imageUrls.get(product.id)}
            isInWatchlist={watchlistIds.has(product.id)}
            onAdd={handleAdd}
            onPress={handlePress}
          />
        </Animated.View>
      ))}
    </View>
  );
});
TrendingSection.displayName = "TrendingSection";

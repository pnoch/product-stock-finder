import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  Animated,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending } from "@shared/trending";
import { useColors } from "@/hooks/use-colors";
import { addToWatchlist, getWatchlist } from "@/lib/storage";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { formatPrice } from "@shared/currency";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchProductImage } from "@/lib/server-images";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useToast } from "@/components/ui/toast";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";

function TrendingSkeletonCard() {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
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
  onPress: (p: TrendingProduct) => void;
}) {
  const colors = useColors();
  const handlePress = useCallback(() => onPress(product), [onPress, product]);
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
    <Pressable
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
            <IconSymbol name="photo" size={18} color={colors.muted} />
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
            {formatPrice(product.estimatedPrice, product.currency)}
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
        <Pressable
          onPress={handleAddPress}
          disabled={isInWatchlist}
          style={{
            backgroundColor: isInWatchlist ? colors.muted : colors.primary,
            opacity: isInWatchlist ? 0.6 : 1,
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
        </Pressable>
      </View>
    </Pressable>
  );
});
TrendingProductRow.displayName = "TrendingProductRow";

export const TrendingSection = memo(function TrendingSection() {
  const colors = useColors();
  const router = useRouter();
  const { showToast } = useToast();
  const [pickerProduct, setPickerProduct] = React.useState<TrendingProduct | null>(null);
  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const [watchlistIds, setWatchlistIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [imageUrls, setImageUrls] = React.useState<Map<string, string>>(
    new Map(),
  );

  useFocusEffect(
    useCallback(() => {
      getWatchlist().then((w) => setWatchlistIds(new Set(w.map((p) => p.id))));
    }, []),
  );

  React.useEffect(() => {
    if (!products) return;
    let active = true;
    const load = async () => {
      const results = await Promise.allSettled(
        products.slice(0, 3).map((p) => fetchProductImage(p.id)),
      );
      if (!active) return;
      const entries: [string, string][] = [];
      results.forEach((r, i) => {
        const product = products[i];
        if (r.status === "fulfilled" && r.value && product) {
          entries.push([product.id, r.value.imageUrl]);
        }
      });
      setImageUrls(new Map(entries));
    };
    load();
    return () => {
      active = false;
    };
  }, [products]);

  // Trending products come from the server, not the local watchlist, so the
  // product detail screen (which reads the watchlist) can't resolve them until
  // they're added. Both the Add button and the card body must therefore add
  // first; the card body then navigates to the detail it just made resolvable.
  const ensureWatchlistProduct = useCallback(
    async (product: TrendingProduct): Promise<boolean> => {
      const catalogProduct = PRODUCT_CATALOG.find((p) => p.id === product.id);
      if (!catalogProduct && !(product as unknown as { modelNumber?: string }).modelNumber) {
        showToast("Not yet available", "info");
        return false;
      }
      const fallbackListings = SAMPLE_LISTINGS[product.id]
        ? (SAMPLE_LISTINGS[product.id] as unknown as never[])
        : ([] as never[]);
      const newProduct = {
        id: product.id,
        name: product.name,
        modelNumber: catalogProduct?.modelNumber ?? (product as unknown as { modelNumber?: string }).modelNumber ?? product.id,
        brand: product.brand,
        category: product.category,
        description: catalogProduct?.description ?? "",
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: fallbackListings,
        tags: [] as string[],
      };
      try {
        await addToWatchlist(newProduct as never);
      } catch {
        showToast("Couldn't add to watchlist", "error");
        return false;
      }
      setWatchlistIds((prev) => new Set([...prev, product.id]));
      return true;
    },
    [showToast],
  );

  const handleAdd = useCallback(
    async (product: TrendingProduct) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (!(await ensureWatchlistProduct(product))) return;
      showToast("Added — tap tag to organize", "success");
      setPickerProduct(product);
    },
    [ensureWatchlistProduct, showToast],
  );

  const handlePress = useCallback(
    async (product: TrendingProduct) => {
      if (!watchlistIds.has(product.id)) {
        if (!(await ensureWatchlistProduct(product))) return;
      }
      router.push(`/product/${product.id}`);
    },
    [ensureWatchlistProduct, router, watchlistIds],
  );

  const visibleProducts = useMemo(() => products?.slice(0, 3) ?? [], [products]);

  const entryAnims = useMemo(() => Array.from({ length: 3 }, () => new Animated.Value(0)), []);

  useEffect(() => {
    if (!visibleProducts.length) return;
    entryAnims.forEach((a) => a.setValue(0));
    Animated.stagger(
      85,
      entryAnims.slice(0, visibleProducts.length).map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 75,
          friction: 9,
        }),
      ),
    ).start();
  }, [visibleProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text
          accessibilityRole="header"
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
        {isError && !products && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Couldn&apos;t load</Text>
            <TouchableOpacity
              onPress={() => void (refetch as unknown as () => Promise<unknown>)()}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
              accessibilityLabel="Retry loading trending"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        <TrendingSkeletonCard />
        <TrendingSkeletonCard />
        <TrendingSkeletonCard />
      </View>
    );
  }
  if (isError && !products) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text
          accessibilityRole="header"
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Couldn&apos;t load</Text>
          <TouchableOpacity
            onPress={() => void (refetch as unknown as () => Promise<unknown>)()}
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
            accessibilityLabel="Retry loading trending"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
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
        accessibilityRole="header"
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
                translateY: entryAnims[idx]!.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
              {
                scale: entryAnims[idx]!.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
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
      {pickerProduct && (
        <TagPickerSheet
          visible={!!pickerProduct}
          product={
            {
              id: pickerProduct.id,
              name: pickerProduct.name,
              modelNumber: PRODUCT_CATALOG.find((p) => p.id === pickerProduct.id)?.modelNumber ?? pickerProduct.id,
              brand: pickerProduct.brand,
              category: pickerProduct.category,
              description: "",
              isWatched: true,
              addedAt: new Date().toISOString(),
              listings: [],
              tags: [],
            } as never
          }
          onClose={() => setPickerProduct(null)}
          onChanged={() => {}}
        />
      )}
    </View>
  );
});
TrendingSection.displayName = "TrendingSection";

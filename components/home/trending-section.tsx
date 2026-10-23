import React, { memo, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { TrendingProduct } from "@/lib/types";
import { fetchTrending, filterTrending } from "@shared/trending";
import { ensureWatchlistProduct } from "@/lib/ensure-watchlist-product";
import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { getWatchlist } from "@/lib/storage";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { useFocusEffect, useRouter } from "expo-router";
import { useToast } from "@/components/ui/toast";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TrendingProductRow } from "./trending-product-row";
import { TrendingSkeletonCard } from "./trending-skeleton-card";

export const TrendingSection = memo(function TrendingSection({
  query = "",
}: {
  query?: string;
} = {}) {
  const colors = useColors();
  const router = useRouter();
  const { showToast } = useToast();
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = React.useState(false);
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

  useFocusEffect(
    useCallback(() => {
      // A storage read failure must not reject unhandled; the added-state
      // simply stays empty.
      getWatchlist()
        .then((w) => setWatchlistIds(new Set(w.map((p) => p.id))))
        .catch(() => {});
    }, []),
  );


  // Trending products come from the server, not the local watchlist, so the
  // product detail screen (which reads the watchlist) can't resolve them until
  // they're added. Both the Add button and the card body must therefore add
  // first; the card body then navigates to the detail it just made resolvable.
  // Delegates to the shared helper so a trending product that is not in the
  // static catalog is still addable (its name becomes the search term) instead
  // of being rejected as "Not yet available".
  const addTrendingProduct = useCallback(
    async (product: TrendingProduct): Promise<boolean> => {
      if (watchlistIds.has(product.id)) return true;
      const result = await ensureWatchlistProduct(
        { ...product, modelNumber: product.name },
        isPro,
      );
      if (result.paywall) {
        setPaywallVisible(true);
        return false;
      }
      if (!result.ok) {
        showToast("Couldn't add to watchlist", "error");
        return false;
      }
      setWatchlistIds((prev) => new Set([...prev, product.id]));
      return true;
    },
    [showToast, watchlistIds, isPro],
  );

  const handleAdd = useCallback(
    async (product: TrendingProduct) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (!(await addTrendingProduct(product))) return;
      showToast("Added — tap tag to organize", "success");
      setPickerProduct(product);
    },
    [addTrendingProduct, showToast],
  );

  const handlePress = useCallback(
    async (product: TrendingProduct) => {
      if (!watchlistIds.has(product.id)) {
        if (!(await addTrendingProduct(product))) return;
      }
      router.push(`/product/${product.id}`);
    },
    [addTrendingProduct, router, watchlistIds],
  );

  const visibleProducts = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return products?.slice(0, 3) ?? [];
    // Searching should find a trending product the user can already see, not
    // just the static catalog.
    return filterTrending(products ?? [], trimmed);
  }, [products, query]);

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
          Trending Now
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
          Trending Now
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
  if (query.trim().length > 0 && visibleProducts.length === 0) return null;

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
        {query.trim().length > 0 ? "Trending matches" : "Trending Now"}
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
        {query.trim().length > 0
          ? "Hard-to-find products matching your search"
          : "Hard-to-find products from the community"}
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
            }
          }
          onClose={() => setPickerProduct(null)}
          onChanged={() => {}}
        />
      )}
      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </View>
  );
});
TrendingSection.displayName = "TrendingSection";

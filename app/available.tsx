import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { StockBadge } from "@/components/stock-badge";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getAllBrands, getAllCategories } from "@shared/catalog";
import { formatPrice } from "@shared/currency";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { getBestPrice } from "@/lib/currency";
import { getSettings, getWatchlist } from "@/lib/storage";
import { isServerConfigured } from "@/constants/oauth";
import { fetchAvailable } from "@/lib/server-catalog";
import { ensureWatchlistProduct } from "@/lib/ensure-watchlist-product";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useToast } from "@/components/ui/toast";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { goBackOrHome } from "@/lib/navigation";
import type { AvailableProduct, Product } from "@/lib/types";

const PRICE_CAPS = [50, 250, 500, 1000];

type Row = {
  id: string;
  name: string;
  brand: string;
  category: string;
  modelNumber?: string;
  price: number;
  currency: string;
  storeCount: number;
  /** Epoch ms the price was cached; undefined for the standalone fallback. */
  fetchedAt?: number;
};

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Filter ${label}`}
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : colors.foreground,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SkeletonRow() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          height: 14,
          width: "60%",
          borderRadius: 6,
          backgroundColor: colors.border,
          marginBottom: 10,
        }}
      />
      <View
        style={{
          height: 11,
          width: "35%",
          borderRadius: 6,
          backgroundColor: colors.border,
        }}
      />
    </View>
  );
}

function AvailableRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${row.name}`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}
          >
            {row.name}
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
            numberOfLines={1}
          >
            {formatPrice(row.price, row.currency)} · in stock at {row.storeCount}{" "}
            {row.storeCount === 1 ? "store" : "stores"}
          </Text>
          {row.fetchedAt != null && Number.isFinite(row.fetchedAt) && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              as of {formatLastRefreshed(new Date(row.fetchedAt).toISOString())}
            </Text>
          )}
        </View>
        <StockBadge status="in_stock" />
      </View>
    </Pressable>
  );
}

export default function AvailableScreen() {
  const colors = useColors();
  const router = useRouter();
  const configured = isServerConfigured();
  const { isPro } = useEntitlements();
  const { showToast } = useToast();

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [brand, setBrand] = useState<string | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [currency, setCurrency] = useState("USD");
  const [fallbackRows, setFallbackRows] = useState<Row[]>([]);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const settings = await getSettings();
      if (active) setCurrency(settings?.displayCurrency ?? "USD");
    })();
    return () => {
      active = false;
    };
  }, []);

  const query = useQuery<AvailableProduct[]>({
    queryKey: [
      "available",
      currency,
      category ?? null,
      brand ?? null,
      maxPrice ?? null,
    ],
    queryFn: () => fetchAvailable({ currency, category, brand, maxPrice }),
    staleTime: 60_000,
    enabled: configured,
  });

  useEffect(() => {
    if (configured) return;
    let active = true;
    (async () => {
      const watchlist = await getWatchlist();
      const rows: Row[] = [];
      for (const product of watchlist as Product[]) {
        const listings = product.listings ?? [];
        const inStock = listings.filter((l) => l.stockStatus === "in_stock");
        if (inStock.length === 0) continue;
        const best = getBestPrice(inStock, currency);
        if (!best) continue;
        rows.push({
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          modelNumber: product.modelNumber,
          price: best.price,
          currency: best.currency,
          storeCount: inStock.length,
        });
      }
      if (active) setFallbackRows(rows);
    })();
    return () => {
      active = false;
    };
  }, [configured, currency]);

  const serverRows = useMemo<Row[]>(
    () =>
      (query.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        modelNumber: p.modelNumber,
        price: p.bestPrice,
        currency: p.bestCurrency,
        storeCount: p.storeCount,
        fetchedAt: p.fetchedAt,
      })),
    [query.data],
  );

  const rows = configured ? serverRows : fallbackRows;
  const loading = configured && query.isLoading;

  // The product detail screen reads the watchlist, so a server row must be
  // added before navigating or it shows "Product not found".
  const openProduct = useCallback(
    async (row: Row) => {
      const result = await ensureWatchlistProduct(row, isPro);
      if (result.paywall) {
        setPaywallVisible(true);
        return;
      }
      if (!result.ok) {
        showToast("Couldn't add to watchlist", "error");
        return;
      }
      router.push(`/product/${row.id}`);
    },
    [isPro, router, showToast],
  );

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: "Available Now" }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => goBackOrHome(router)}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Available Now
        </Text>
      </View>

      {!configured && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13 }}>
            Connect to see all 121 products, ranked by price.
          </Text>
        </View>
      )}

      {configured && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        >
          <Chip
            label="All categories"
            active={category === undefined}
            onPress={() => setCategory(undefined)}
          />
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              active={category === c}
              onPress={() => setCategory(category === c ? undefined : c)}
            />
          ))}
        </ScrollView>
      )}

      {configured && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        >
          <Chip
            label="All brands"
            active={brand === undefined}
            onPress={() => setBrand(undefined)}
          />
          {brands.map((b) => (
            <Chip
              key={b}
              label={b}
              active={brand === b}
              onPress={() => setBrand(brand === b ? undefined : b)}
            />
          ))}
        </ScrollView>
      )}

      {configured && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        >
          <Chip
            label="Any price"
            active={maxPrice === undefined}
            onPress={() => setMaxPrice(undefined)}
          />
          {PRICE_CAPS.map((cap) => (
            <Chip
              key={cap}
              label={`Under ${formatPrice(cap, currency)}`}
              active={maxPrice === cap}
              onPress={() => setMaxPrice(maxPrice === cap ? undefined : cap)}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : configured && query.isError ? (
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: 32,
              marginTop: 48,
            }}
          >
            <IconSymbol
              name="exclamationmark.triangle"
              size={30}
              color={colors.muted}
            />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 16,
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Couldn&apos;t load available products
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Retry loading available"
              onPress={() => void query.refetch()}
              style={{
                marginTop: 16,
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingHorizontal: 18,
                paddingVertical: 9,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: 32,
              marginTop: 48,
            }}
          >
            <IconSymbol name="magnifyingglass" size={30} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 16,
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Nothing in stock right now — check back
            </Text>
            {!configured && (
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                Add products to your watchlist to see what&apos;s available.
              </Text>
            )}
          </View>
        ) : (
          rows.map((row) => (
            <AvailableRow
              key={row.id}
              row={row}
              onPress={() => void openProduct(row)}
            />
          ))
        )}
      </ScrollView>
      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </ScreenContainer>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { useToast } from "@/components/ui/toast";
import {
  buildDropShareText,
  computeLocalDrops,
  formatDropPct,
  type DropSortBy,
  type DropWindow,
  type PriceDrop,
} from "@/lib/price-leaderboard";
import { getSettings, getWatchlist } from "@/lib/storage";
import { createTRPCClient } from "@/lib/trpc";
import { shareText } from "@/lib/share-text";
import { formatPrice } from "@shared/currency";
import type { Product } from "@/lib/types";

const WINDOWS: DropWindow[] = ["24h", "7d", "30d"];
const SORTS: { key: DropSortBy; label: string }[] = [
  { key: "pct", label: "%" },
  { key: "abs", label: "$" },
];

type DropsTab = "your" | "global";

const GLOBAL_CACHE_TTL_MS = 5 * 60 * 1000;
const globalCache = new Map<string, { at: number; data: PriceDrop[] }>();

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function DropRow({
  drop,
  onPress,
}: {
  drop: PriceDrop;
  onPress: () => void;
}) {
  const colors = useColors();
  const pctText = formatDropPct(drop.dropPct);
  const absText = `\u2212${formatPrice(drop.dropAbs, drop.currency)}`;
  const priceLine = `${formatPrice(drop.previousPrice, drop.currency)} \u2192 ${formatPrice(drop.currentPrice, drop.currency)}`;
  const subtitle = drop.modelNumber
    ? `${drop.modelNumber}`
    : drop.distributorName;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
      accessibilityLabel={`View ${drop.productName}`}
      accessibilityRole="button"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: colors.primary + "1A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>
          {initials(drop.productName)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {drop.productName}
        </Text>
        <Text
          style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subtitle}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 8,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}
              numberOfLines={1}
            >
              {drop.distributorName}
            </Text>
          </View>
          <Text
            style={{ fontSize: 11, color: colors.muted }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {priceLine}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.success }}>
          {pctText}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
          {absText}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DropsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [window, setWindow] = useState<DropWindow>("7d");
  const [sortBy, setSortBy] = useState<DropSortBy>("pct");
  const [tab, setTab] = useState<DropsTab>("your");
  const [globalDrops, setGlobalDrops] = useState<PriceDrop[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const failedKeysRef = useRef<Set<string>>(new Set());

  const [client] = useState(() => createTRPCClient());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const [watchlist, settings] = await Promise.all([
            getWatchlist(),
            getSettings(),
          ]);
          if (!active) return;
          setProducts(watchlist);
          setDisplayCurrency(settings?.displayCurrency ?? "USD");
        } catch {
          // storage read failure — keep existing state
        } finally {
          if (active) setLoaded(true);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!isAuthenticated && tab === "global") setTab("your");
  }, [isAuthenticated, tab]);

  useEffect(() => {
    if (tab !== "global" || !isAuthenticated) return;
    const key = `${window}:${sortBy}`;
    const cached = globalCache.get(key);
    if (cached && Date.now() - cached.at < GLOBAL_CACHE_TTL_MS) {
      setGlobalDrops(cached.data);
      return;
    }
    let active = true;
    setGlobalLoading(true);
    client.prices.topDrops
      .query({ window, limit: 20, sortBy })
      .then((rows) => {
        if (!active) return;
        const drops = rows as PriceDrop[];
        globalCache.set(key, { at: Date.now(), data: drops });
        setGlobalDrops(drops);
      })
      .catch(() => {
        if (!active) return;
        setTab("your");
        if (!failedKeysRef.current.has(key)) {
          failedKeysRef.current.add(key);
          showToast("Couldn't load global drops — showing yours", "error");
        }
      })
      .finally(() => {
        if (active) setGlobalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, isAuthenticated, window, sortBy, client, showToast]);

  const localDrops = useMemo(
    () => computeLocalDrops(products, window, displayCurrency, sortBy, 20),
    [products, window, displayCurrency, sortBy],
  );

  const watchlistIds = useMemo(
    () => new Set(products.map((p) => p.id)),
    [products],
  );

  const visibleDrops = tab === "your" ? localDrops : globalDrops;
  const loading = !loaded || (tab === "global" && globalLoading);

  const handleRowPress = useCallback(
    (drop: PriceDrop) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (watchlistIds.has(drop.productId)) {
        router.push(`/product/${drop.productId}`);
      } else {
        router.push("/search");
      }
    },
    [router, watchlistIds],
  );

  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (visibleDrops.length === 0) {
      showToast("Nothing to share yet", "info");
      return;
    }
    const result = await shareText(
      buildDropShareText(visibleDrops, window, sortBy),
      "Price Drops",
    );
    if (result === "copied") {
      showToast("Drops copied to your clipboard");
    } else if (result === "failed") {
      showToast("Sharing isn't supported in this browser", "error");
    }
  }, [visibleDrops, window, sortBy, showToast]);

  const selectTab = useCallback((next: DropsTab) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTab(next);
  }, []);

  return (
    <ScreenContainer>
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
          onPress={() => router.back()}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 28,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Price Drops
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityLabel="Share price drops"
          accessibilityRole="button"
          onPress={() => void handleShare()}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol
            name="square.and.arrow.up"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 8,
          gap: 6,
        }}
      >
        {WINDOWS.map((w) => (
          <TouchableOpacity
            key={w}
            activeOpacity={0.7}
            accessibilityLabel={`Show drops from last ${w}`}
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setWindow(w);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: window === w ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: window === w ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: window === w ? "#fff" : colors.foreground,
              }}
            >
              {w}
            </Text>
          </TouchableOpacity>
        ))}
        <View
          style={{
            width: 1,
            backgroundColor: colors.border,
            marginHorizontal: 4,
            marginVertical: 2,
          }}
        />
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            activeOpacity={0.7}
            accessibilityLabel={`Sort by ${s.key === "pct" ? "percentage" : "amount"}`}
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setSortBy(s.key);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: sortBy === s.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: sortBy === s.key ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: sortBy === s.key ? "#fff" : colors.foreground,
              }}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isAuthenticated ? (
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
            gap: 4,
          }}
        >
          {(["your", "global"] as DropsTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              activeOpacity={0.7}
              accessibilityLabel={
                t === "your" ? "Show your drops" : "Show global drops"
              }
              accessibilityRole="button"
              onPress={() => selectTab(t)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor:
                  tab === t ? colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: tab === t ? "#fff" : colors.foreground,
                }}
              >
                {t === "your" ? "Your Drops" : "Global Drops"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 60,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
            Loading drops...
          </Text>
        </View>
      ) : visibleDrops.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <EmptyStateView
            icon="chart.line.downtrend.xyaxis"
            title={
              tab === "your" ? "No drops this period" : "No drops found"
            }
            subtitle={
              tab === "your"
                ? "No drops this period — add products to your watchlist to track them"
                : "No drops found — try a longer time range"
            }
            ctaLabel={tab === "your" ? "Browse Products" : undefined}
            onCtaPress={
              tab === "your" ? () => router.push("/search") : undefined
            }
          />
        </View>
      ) : (
        <FlatList
          data={visibleDrops}
          keyExtractor={(item) => `${item.productId}:${item.distributorId}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <DropRow drop={item} onPress={() => handleRowPress(item)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

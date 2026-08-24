import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSettings, getWatchlist } from "@/lib/storage";
import type { Product } from "@/lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "@/lib/watchlist-stats";
import { MoversCard } from "@/components/stats/movers-card";
import { BasketValueCard } from "@/components/stats/basket-value-card";
import { StockHealthCard } from "@/components/stats/stock-health-card";
import { DataFreshnessCard } from "@/components/stats/data-freshness-card";

export default function StatsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [days, setDays] = useState<MoversWindow>(30);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [wl, settings] = await Promise.all([
        getWatchlist(),
        getSettings(),
      ]);
      setWatchlist(wl);
      setDisplayCurrency(settings.displayCurrency);
      setLoaded(true);
    })();
  }, []);

  const movers = useMemo(
    () => computeMovers(watchlist, displayCurrency, days),
    [watchlist, displayCurrency, days],
  );
  const basket = useMemo(
    () => computeBasketValue(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );
  const stockHealth = useMemo(() => computeStockHealth(watchlist), [watchlist]);
  const freshness = useMemo(() => computeDataFreshness(watchlist), [watchlist]);

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
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={{ padding: 4 }}
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
          Statistics
        </Text>
      </View>

      {loaded && watchlist.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            paddingTop: 80,
            paddingHorizontal: 32,
          }}
        >
          <IconSymbol
            name="chart.bar.xaxis"
            size={40}
            color={colors.muted}
          />
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 16,
              marginTop: 12,
            }}
          >
            No statistics yet
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              textAlign: "center",
              marginTop: 6,
            }}
          >
            Add products to your watchlist to see price trends and stock health.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <MoversCard movers={movers} days={days} onDaysChange={setDays} />
          <BasketValueCard basket={basket} displayCurrency={displayCurrency} />
          <StockHealthCard health={stockHealth} />
          <DataFreshnessCard freshness={freshness} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

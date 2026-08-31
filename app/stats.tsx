import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { getAlerts, getSettings, getWatchlist, getPriceDigestSnapshot, saveSettings } from "@/lib/storage";
import { BasketAlertSheet } from "@/components/stats/basket-alert-sheet";
import type { Product, AppSettings, PriceAlert } from "@/lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "@/lib/watchlist-stats";
import { computeProductInsights } from "@/lib/product-insights";
import { computeDropCalendar } from "@/lib/drop-calendar";
import { InsightsCard } from "@/components/stats/insights-card";
import { DropCalendarCard } from "@/components/stats/drop-calendar-card";
import {
  computeDigest,
  type DigestSnapshot,
} from "@/lib/price-digest";
import { DigestCard } from "@/components/stats/digest-card";
import { buildWatchlistShareText } from "@/lib/watchlist-share";
import { captureAndShareImage } from "@/lib/share-image";
import { StatsShareCard } from "@/components/share/stats-share-card";
import { showAlert } from "@/lib/alert";
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
  const [digestSnapshot, setDigestSnapshot] = useState<DigestSnapshot | null>(
    null,
  );
  const [digestFrequency, setDigestFrequency] = useState<string>("off");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [basketThreshold, setBasketThreshold] = useState<number | null>(null);
  const [basketSheetVisible, setBasketSheetVisible] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    void (async () => {
      const [wl, loadedSettings, snapshot, loadedAlerts] = await Promise.all([
        getWatchlist(),
        getSettings(),
        getPriceDigestSnapshot(),
        getAlerts(),
      ]);
      setWatchlist(wl);
      setSettings(loadedSettings);
      setDisplayCurrency(loadedSettings?.displayCurrency ?? "USD");
      setDigestFrequency(loadedSettings?.digestFrequency ?? "off");
      setBasketThreshold(loadedSettings?.basketAlertThreshold ?? null);
      setDigestSnapshot(snapshot);
      setAlerts(loadedAlerts);
      setLoaded(true);
    })();
  }, []);

  const digest = useMemo(() => {
    if (!digestSnapshot || !settings || digestFrequency === "off") return null;
    return computeDigest(digestSnapshot, watchlist, settings, alerts);
  }, [digestSnapshot, watchlist, settings, alerts, digestFrequency]);

  const handleSaveBasketAlert = useCallback(
    async (threshold: number | null) => {
      setBasketThreshold(threshold);
      const s = await getSettings();
      await saveSettings({ ...s, basketAlertThreshold: threshold });
    },
    [],
  );

  const insights = useMemo(
    () => computeProductInsights(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const dropCalendar = useMemo(
    () => computeDropCalendar(watchlist, displayCurrency, 30),
    [watchlist, displayCurrency],
  );

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

  const shareCardRef = useRef<View>(null);

  const shareAsText = async () => {
    try {
      await Share.share({
        message: buildWatchlistShareText({
          watchlist,
          displayCurrency,
          days,
        }),
        title: "My Watchlist",
      });
    } catch {
      // User cancelled share
    }
  };

  const handleShare = async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAlert("Share", undefined, [
      {
        text: "Share as Image",
        onPress: async () => {
          const ok = await captureAndShareImage(
            shareCardRef,
            "watchlist-share",
          );
          if (!ok) await shareAsText();
        },
      },
      { text: "Share as Text", onPress: shareAsText },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
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
        <TouchableOpacity activeOpacity={0.7} accessibilityLabel="Share statistics" accessibilityRole="button" onPress={handleShare} style={{ padding: 4 }}>
          <IconSymbol
            name="square.and.arrow.up"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {!loaded ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Loading statistics...</Text>
        </View>
      ) : watchlist.length === 0 ? (
        <EmptyStateView
          icon="chart.bar.xaxis"
          title="No statistics yet"
          subtitle="Add products to your watchlist to see price trends and stock health."
          ctaLabel="Browse Products"
          onCtaPress={() => router.push("/search")}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {digest && (
            <DigestCard
              result={digest}
              periodLabel={
                digestFrequency === "weekly" ? "this week" : "today"
              }
              displayCurrency={displayCurrency}
            />
          )}
          <MoversCard movers={movers} days={days} onDaysChange={setDays} />
          <InsightsCard result={insights} />
          <DropCalendarCard
            result={dropCalendar}
            days={30}
            displayCurrency={displayCurrency}
          />
          <BasketValueCard
            basket={basket}
            displayCurrency={displayCurrency}
            alertThreshold={basketThreshold}
            onOpenAlert={() => setBasketSheetVisible(true)}
          />
          <StockHealthCard health={stockHealth} />
          <DataFreshnessCard freshness={freshness} />
        </ScrollView>
      )}

      <View
        style={{
          position: "absolute",
          left: -9999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <StatsShareCard
          ref={shareCardRef}
          basketTotal={basket.total}
          productCount={basket.productCount}
          displayCurrency={displayCurrency}
          drops={movers.drops.slice(0, 3).map((d) => ({
            flag: d.countryFlag,
            name: d.productName,
            pct: d.changePct,
          }))}
          stockLine={
            stockHealth.totalListings > 0
              ? `${stockHealth.inStockPct}% in stock · ${stockHealth.fullyOutOfStock} fully out of stock`
              : null
          }
        />
      </View>

      <BasketAlertSheet
        visible={basketSheetVisible}
        onClose={() => setBasketSheetVisible(false)}
        currentThreshold={basketThreshold}
        onSave={handleSaveBasketAlert}
      />
    </ScreenContainer>
  );
}

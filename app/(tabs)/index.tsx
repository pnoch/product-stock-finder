import { log } from "@shared/log";
import { useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";


import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-provider";
import { rearmAlert } from "@/lib/storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useConnection } from "@/hooks/use-connection";
import { useMonitoringHealth } from "@/hooks/use-monitoring-health";
import { useHomeData } from "@/hooks/use-home-data";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFeed } from "@/components/home/home-feed";
import { HomeWatchlistPreview } from "@/components/home/home-watchlist-preview";
import { showAlert } from "@/lib/alert";
import { greetingFor, buildFeedItems } from "@/lib/home-feed";
import { DISTRIBUTORS } from "@shared/distributors";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const connection = useConnection();
  const { health: monitoring } = useMonitoringHealth();
  const [monitoringDismissed, setMonitoringDismissed] = useState(false);
  const { settings } = useSettings();
  const displayCurrency = settings.displayCurrency;

  const {
    watchlist,
    alerts,
    refreshing,
    loaded,
    loadError,
    awaySummary,
    onRefresh,
    loadData,
    retry,
  } = useHomeData(displayCurrency);

  const feedItems = useMemo(
    () =>
      buildFeedItems({
        alerts,
        products: watchlist,
        awaySummary,
        displayCurrency,
      }),
    [alerts, watchlist, awaySummary, displayCurrency],
  );

  const productNames = useMemo(
    () => new Map(watchlist.map((p) => [p.id, p.name] as const)),
    [watchlist],
  );

  const handleViewProduct = useCallback(
    (productId: string) => {
      router.push(`/product/${productId}`);
    },
    [router],
  );

  const handleRearm = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await rearmAlert(alertId);
        await loadData();
      } catch (e) {
        log.error("[Home] re-arm failed", e);
        showAlert("Re-arm failed", "We couldn't re-arm that alert. Please try again.");
        return;
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [loadData],
  );

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <HomeHeader
          greeting={greeting}
          connectionStatus={connection.status}
          onOpenSettings={() => router.push("/(tabs)/settings")}
          onOpenProfile={() => router.push("/you")}
          onAddProduct={() => router.push("/search")}
          monitoring={monitoring}
          monitoringDismissed={monitoringDismissed}
          onDismissMonitoring={() => setMonitoringDismissed(true)}
        />

        {!loaded ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Loading watchlist…</Text>
          </View>
        ) : loadError ? (
          <View className="px-5">
            <View className="bg-surface rounded-2xl p-6 items-center border border-border">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.error + "14",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.error + "22",
                }}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={24} color={colors.error} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginTop: 12, textAlign: "center" }}>
                Couldn&apos;t load watchlist
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: "center" }}>
                {loadError}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityLabel="Retry loading watchlist"
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  marginTop: 14,
                }}
                onPress={retry}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : watchlist.length === 0 ? (
          <View className="px-5">
            <View className="bg-surface rounded-2xl p-8 items-center border border-border">
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primary + "14",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.primary + "22",
                }}
              >
                <IconSymbol
                  name="magnifyingglass"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text className="text-foreground font-semibold mt-4 text-base">
                Nothing on the radar yet
              </Text>
              <Text className="text-muted text-sm text-center mt-1 px-2">
                Tap + and paste a model number — we&apos;ll check all {DISTRIBUTORS.length} distributors and alert you the moment it&apos;s in stock.
              </Text>
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: colors.primary + "22",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconSymbol name="lightbulb.fill" size={16} color={colors.warning} />
                <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                  Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.85}
                accessibilityLabel="Add product"
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 16,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <HomeFeed
              feedItems={feedItems}
              productNames={productNames}
              onViewProduct={handleViewProduct}
              onRearm={handleRearm}
            />

            <HomeWatchlistPreview
              watchlist={watchlist}
              displayCurrency={displayCurrency}
              onViewProduct={handleViewProduct}
              onViewAll={() => router.push("/(tabs)/watchlist")}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

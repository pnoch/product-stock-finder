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
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";


import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-provider";
import { rearmAlert } from "@/lib/storage";
import { Product, StockStatus } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ConnectionBadge } from "@/components/connection-badge";
import { useConnection } from "@/hooks/use-connection";
import { useMonitoringHealth } from "@/hooks/use-monitoring-health";
import { useHomeData } from "@/hooks/use-home-data";
import { showAlert } from "@/lib/alert";
import { greetingFor, buildFeedItems } from "@/lib/home-feed";
import { DISTRIBUTORS } from "@shared/distributors";
import {
  AlertFiredCard,
  DropCard,
  RestockCard,
  QuietCard,
} from "@/components/home/feed-card";

const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

// Derive best stock status across all listings for a product
function getBestStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (!listings.length) return "unknown";
  const sorted = [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  );
  return sorted[0]!.stockStatus;
}

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
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              {greeting}
            </Text>
            <Text className="text-muted text-sm">
              Here&apos;s what needs your attention.
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ConnectionBadge
              status={connection.status}
              onPress={
                connection.status === "signed-out" ||
                connection.status === "local"
                  ? () => router.push("/(tabs)/settings")
                  : undefined
              }
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => router.push("/you")}
              accessibilityLabel="Open profile and settings"
              accessibilityRole="button"
              style={{ padding: 8 }}
            >
              <IconSymbol name="gearshape.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85}
              accessibilityLabel="Add product"
              accessibilityRole="button"
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search");
              }}
            >
              <IconSymbol name="plus" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {!monitoringDismissed &&
          (monitoring.status === "stopped" || monitoring.status === "stale") && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginHorizontal: 16,
                marginBottom: 4,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.warning + "55",
                backgroundColor: colors.warning + "1A",
              }}
            >
              <Pressable
                onPress={() => router.push("/(tabs)/settings")}
                accessibilityRole="button"
                accessibilityLabel="Background monitoring may have stopped. Tap to fix."
                style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
              >
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={colors.warning}
                />
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 13 }}>
                  Background monitoring may have stopped — tap to fix.
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMonitoringDismissed(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss monitoring warning"
                hitSlop={8}
              >
                <IconSymbol name="xmark" size={16} color={colors.muted} />
              </Pressable>
            </View>
          )}

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
            {/* Priority feed */}
            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              {feedItems.map((item) => {
                switch (item.kind) {
                  case "alerts":
                    return (
                      <AlertFiredCard
                        key="alerts"
                        alerts={item.alerts}
                        names={productNames}
                        onView={handleViewProduct}
                        onRearm={handleRearm}
                      />
                    );
                  case "drops":
                    return <DropCard key="drops" drops={item.drops} />;
                  case "restocks":
                    return (
                      <RestockCard
                        key="restocks"
                        productIds={item.productIds}
                        names={item.names}
                        onView={handleViewProduct}
                      />
                    );
                  case "quiet":
                    return <QuietCard key="quiet" dropCount={item.dropCount} />;
                }
              })}
            </View>

            {/* Watchlist preview */}
            <View className="px-5">
              <Text className="text-base font-semibold text-foreground mb-3">
                Your Watchlist
              </Text>
              {watchlist.slice(0, 3).map((product) => {
                const bestPrice = getBestPrice(
                  product.listings ?? [],
                  displayCurrency,
                );
                const bestStatus = getBestStatus(product);
                return (
                  <TouchableOpacity activeOpacity={0.7}
                    key={product.id}
                    accessibilityLabel={`${product.name}, ${bestPrice ? formatPrice(bestPrice.price, bestPrice.currency) : "no price"}`}
                    accessibilityRole="button"
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                    onPress={() => router.push(`/product/${product.id}`)}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {product.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {product.brand} · {product.category}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {bestPrice && (
                        <Text
                          style={{
                            color: colors.primary,
                            fontWeight: "700",
                            fontSize: 15,
                          }}
                        >
                          {formatPrice(bestPrice.price, bestPrice.currency)}
                        </Text>
                      )}
                      <View style={{ marginTop: 4 }}>
                        <StockBadge status={bestStatus} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {watchlist.length > 3 && (
                <TouchableOpacity activeOpacity={0.7}
                  onPress={() => router.push("/(tabs)/watchlist")}
                  accessibilityLabel={`View all ${watchlist.length} product${watchlist.length === 1 ? "" : "s"}`}
                  accessibilityRole="button"
                  style={{ alignItems: "center", paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    View all {watchlist.length} product{watchlist.length === 1 ? "" : "s"} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

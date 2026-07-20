import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, Switch, RefreshControl } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAlerts, removeAlert, toggleAlert, getWatchlist, markAlertPurchased, getDistributorWatches, toggleDistributorWatch } from "@/lib/storage";
import { PriceAlert, Product } from "@/lib/types";
import { getDistributorById } from "@/lib/distributors";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AlertsScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedDistributors, setWatchedDistributors] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    const [a, p] = await Promise.all([getAlerts(), getWatchlist()]);
    setAlerts(a);
    setProducts(p);
    const watches = await getDistributorWatches();
    setWatchedDistributors(watches);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(async (alertId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleAlert(alertId);
    await loadData();
  }, [loadData]);

  const handleDelete = useCallback(async (alertId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeAlert(alertId);
    await loadData();
  }, [loadData]);

  const handleMarkPurchased = useCallback(async (alertId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markAlertPurchased(alertId);
    await loadData();
  }, [loadData]);

  const handleRemoveDistributorWatch = useCallback(async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const [productId, distributorId] = key.split("::");
    await toggleDistributorWatch(productId, distributorId);
    const watches = await getDistributorWatches();
    setWatchedDistributors(watches);
  }, []);

  const activeWatches = Object.entries(watchedDistributors).filter(([, v]) => v);

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => a.triggeredAt && !a.purchasedAt);
  const purchasedAlerts = alerts.filter((a) => a.purchasedAt);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">Alerts</Text>
        <Text className="text-muted text-sm">{activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""}</Text>
      </View>

      <FlatList
        data={activeAlerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          activeAlerts.length > 0 ? (
            <View style={{ backgroundColor: colors.primary + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol name="info.circle.fill" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>
                You'll be notified when a product's price drops below your target.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
            <IconSymbol name="bell.fill" size={48} color={colors.muted} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 18, marginTop: 16 }}>No alerts set</Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
              Open a product and tap "Set Alert" to get notified when the price drops.
            </Text>
          </View>
        }
        ListFooterComponent={
          (triggeredAlerts.length > 0 || activeWatches.length > 0) ? (
            <View style={{ marginTop: 8 }}>
              {activeWatches.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                    Watched Distributors
                  </Text>
                  {activeWatches.map(([key]) => {
                    const [productId, distributorId] = key.split("::");
                    const product = products.find((p) => p.id === productId);
                    const distributor = getDistributorById(distributorId);
                    return (
                      <View key={key} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.primary + "44", flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                            {distributor?.countryFlag} {distributor?.name ?? distributorId}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {product?.name ?? productId}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveDistributorWatch(key)}
                          style={{ padding: 8, backgroundColor: colors.error + "22", borderRadius: 10 }}
                        >
                          <IconSymbol name="bell.slash.fill" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                History
              </Text>
              {triggeredAlerts.map((item) => (
                <View
                  key={item.id}
                  style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.success + "44" }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={2}>
                        {getProductName(item.productId)}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
                        <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                        <Text style={{ color: colors.muted, fontSize: 13 }}>
                          Target: {formatPrice(item.targetPrice, item.currency)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                        <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                        <Text style={{ color: colors.success, fontSize: 12 }}>
                          Triggered {new Date(item.triggeredAt!).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                      <IconSymbol name="trash.fill" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  {/* Mark as Purchased button */}
                  <TouchableOpacity
                    onPress={() => handleMarkPurchased(item.id)}
                    style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.success + "22", borderRadius: 10, paddingVertical: 8 }}
                  >
                    <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: "600", fontSize: 13 }}>Mark as Purchased</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {purchasedAlerts.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                    Purchased
                  </Text>
                  {purchasedAlerts.map((item) => (
                    <View
                      key={item.id}
                      style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, opacity: 0.7 }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                            {getProductName(item.productId)}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                            Target: {formatPrice(item.targetPrice, item.currency)} · Purchased {new Date(item.purchasedAt!).toLocaleDateString()}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                          <IconSymbol name="trash.fill" size={14} color={colors.muted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: item.triggeredAt ? colors.success + "44" : colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={2}>
                  {getProductName(item.productId)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
                  <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Target: {formatPrice(item.targetPrice, item.currency)}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <Switch
                  value={item.isActive}
                  onValueChange={() => handleToggle(item.id)}
                  trackColor={{ false: colors.border, true: colors.primary + "88" }}
                  thumbColor={item.isActive ? colors.primary : colors.muted}
                />
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                  <IconSymbol name="trash.fill" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

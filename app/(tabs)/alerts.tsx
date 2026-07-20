import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, Switch, RefreshControl } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAlerts, removeAlert, toggleAlert, getWatchlist } from "@/lib/storage";
import { PriceAlert, Product } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AlertsScreen() {
  const colors = useColors();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [a, p] = await Promise.all([getAlerts(), getWatchlist()]);
    setAlerts(a);
    setProducts(p);
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

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

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
          triggeredAlerts.length > 0 ? (
            <View style={{ marginTop: 8 }}>
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
                </View>
              ))}
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, RefreshControl, Platform, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { FxRateGrid } from "@/components/rates/fx-rate-grid";
import { EXCHANGE_RATES } from "@shared/currency";
import { getFxHistory } from "@/lib/storage";
import { FX_WINDOWS, getFxWindowChange, sliceFxHistoryByRange, type FxWindow } from "@/lib/fx-history";
import { maybeRefreshFxRates, refreshFxRates } from "@/lib/fx";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import type { FxHistory } from "@/lib/storage/fx-history";

export default function RatesScreen() {
  const colors = useColors();
  const [history, setHistory] = useState<FxHistory | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<FxWindow>("All");

  const loadData = useCallback(async () => {
    const h = await getFxHistory();
    setHistory(h);
  }, []);

  useEffect(() => {
    void loadData();
    void maybeRefreshFxRates().then(loadData, loadData);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await refreshFxRates();
      await loadData();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const onRangeChange = useCallback((r: FxWindow) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRange(r);
  }, []);

  const lastUpdated = history?.timestamps?.length
    ? history.timestamps[history.timestamps.length - 1]
    : null;

  const sliced = useMemo(
    () => (history ? sliceFxHistoryByRange(history, range) : null),
    [history, range],
  );

  const currentRates = sliced?.rates
    ? Object.fromEntries(
        Object.entries(sliced.rates).map(([code, rates]) => {
          const last = rates[rates.length - 1];
          return [code, last !== null && last !== undefined && Number.isFinite(last) ? last : (EXCHANGE_RATES[code] ?? 1)];
        })
      )
    : EXCHANGE_RATES;

  const change = history ? getFxWindowChange(history, range) : {};

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 4,
          }}
        >
          Exchange Rates
        </Text>
        <Text
          style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}
        >
          {lastUpdated
            ? `Last updated ${formatLastRefreshed(new Date(lastUpdated).toISOString())}`
            : "No data yet — rates update hourly"}
        </Text>
        <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
          {FX_WINDOWS.map((r) => {
            const active = r === range;
            return (
              <TouchableOpacity activeOpacity={0.85}
                key={r}
                onPress={() => onRangeChange(r)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: active ? colors.primary : colors.border + "44",
                }}
                accessibilityLabel={`Select ${r} time range`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <FxRateGrid
          currentRates={currentRates}
          history={sliced?.rates ?? {}}
          change={change}
        />
      </ScrollView>
    </ScreenContainer>
  );
}



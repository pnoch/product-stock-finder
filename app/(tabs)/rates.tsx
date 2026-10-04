import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Generation guard: the mount effect fires loadData() immediately and again
  // after maybeRefreshFxRates() resolves. Both await a storage read, so the
  // earlier (pre-refresh) read could land last and show stale rates.
  const loadGenRef = useRef(0);

  const loadData = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const h = await getFxHistory();
    if (gen !== loadGenRef.current) return;
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

  // "Current" rate = the last finite value across the FULL history, not the
  // window-sliced series: tapping a range must not change the headline number,
  // and a window with no fresh point must not fall back to the static table.
  const currentRates = useMemo(() => {
    if (!history) return EXCHANGE_RATES;
    const entries = Object.entries(history.rates).map(([code, rates]) => {
      let last: number | null = null;
      for (let i = rates.length - 1; i >= 0; i--) {
        const v = rates[i];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          last = v;
          break;
        }
      }
      return [code, last ?? EXCHANGE_RATES[code] ?? 1] as const;
    });
    return Object.fromEntries(entries);
  }, [history]);

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



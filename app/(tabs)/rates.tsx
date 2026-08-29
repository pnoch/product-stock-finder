import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { FxRateGrid } from "@/components/rates/fx-rate-grid";
import { EXCHANGE_RATES } from "@/lib/currency";
import { getFxHistory } from "@/lib/storage";
import { getFxChange } from "@/lib/fx-history";
import type { FxHistory } from "@/lib/storage/fx-history";

export default function RatesScreen() {
  const colors = useColors();
  const [history, setHistory] = useState<FxHistory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const h = await getFxHistory();
    setHistory(h);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const lastUpdated = history?.timestamps?.length
    ? history.timestamps[history.timestamps.length - 1]
    : null;

  const currentRates = history?.rates
    ? Object.fromEntries(
        Object.entries(history.rates).map(([code, rates]) => [
          code,
          rates[rates.length - 1] ?? EXCHANGE_RATES[code] ?? 1,
        ])
      )
    : EXCHANGE_RATES;

  const change = history ? getFxChange(history) : {};

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
          style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}
        >
          {lastUpdated
            ? `Last updated ${formatTimeAgo(lastUpdated)}`
            : "No data yet — rates update hourly"}
        </Text>
        <FxRateGrid
          currentRates={currentRates}
          history={history?.rates ?? {}}
          change={change}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

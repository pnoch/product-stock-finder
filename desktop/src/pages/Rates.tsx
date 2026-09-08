import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { EXCHANGE_RATES, formatPrice } from "@shared/currency";
import { storage } from "../storage";
import { getFxChange } from "../../../lib/fx-history";
import { maybeRefreshFxRates, refreshFxRates } from "../../../lib/fx";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import type { FxHistory } from "../../../lib/storage/fx-history";

const CURRENCY_INFO: Record<string, { flag: string }> = {
  USD: { flag: "🇺🇸" },
  EUR: { flag: "🇪🇺" },
  GBP: { flag: "🇬🇧" },
  MYR: { flag: "🇲🇾" },
  AUD: { flag: "🇦🇺" },
  NZD: { flag: "🇳🇿" },
  CAD: { flag: "🇨🇦" },
  ZAR: { flag: "🇿🇦" },
  THB: { flag: "🇹🇭" },
  SGD: { flag: "🇸🇬" },
  HKD: { flag: "🇭🇰" },
  AED: { flag: "🇦🇪" },
};

function Sparkline({ values, color, currency }: { values: (number | null)[]; color: string; currency: string }) {
  const filtered = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (filtered.length < 2) return <div className="h-6 mt-2" />;
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min;
  let points = "";
  if (range === 0) {
    points = filtered.map((_, i) => `${(i / (filtered.length - 1)) * 56},11`).join(" ");
  } else {
    points = filtered.map((v, i) => `${(i / (filtered.length - 1)) * 56},${20 - ((v - min) / range) * 18}`).join(" ");
  }
  const firstValue = filtered[0];
  const lastValue = filtered[filtered.length - 1];
  const trend = lastValue > firstValue ? "up" : lastValue < firstValue ? "down" : "flat";
  const sparklineLabel = `Exchange rate sparkline, trending ${trend}, ${formatPrice(firstValue, currency)} to ${formatPrice(lastValue, currency)}`;
  return (
    <svg width={60} height={24} className="mt-2" role="img" aria-label={sparklineLabel}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function Rates() {
  const [history, setHistory] = useState<FxHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const h = await storage.getFxHistory();
      setHistory(h);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    void maybeRefreshFxRates(storage).then(loadData, loadData);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshFxRates(storage);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const lastUpdated = history?.timestamps?.length ? history.timestamps[history.timestamps.length - 1] : null;

  const currentRates: Record<string, number> = history?.rates
    ? Object.fromEntries(
        Object.entries(history.rates).map(([code, rates]) => {
          const last = rates[rates.length - 1];
          return [code, last !== null && last !== undefined && Number.isFinite(last) ? last : (EXCHANGE_RATES[code] ?? 1)];
        }),
      )
    : (EXCHANGE_RATES as Record<string, number>);

  const change = history ? getFxChange(history) : {};

  const currencies = Object.keys(CURRENCY_INFO);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-3">
          {currencies.map((c) => (
            <div key={c} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Exchange Rates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lastUpdated ? `Last updated ${formatLastRefreshed(new Date(lastUpdated).toISOString())}` : "No data yet — rates update hourly"}
          </p>
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
          aria-label="Refresh rates"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {!history && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          No cached history yet. Showing base rates. Pull to refresh.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currencies.map((code) => {
          const rate = currentRates[code] ?? 1;
          const ch = change[code] ?? 0;
          const hist = history?.rates[code] ?? [];
          const chColor = ch > 0 ? "text-emerald-600" : ch < 0 ? "text-red-500" : "text-gray-500";
          return (
            <div key={code} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{CURRENCY_INFO[code]?.flag ?? ""}</span>
                <span className="font-semibold text-sm">{code}</span>
              </div>
              <div className="text-lg font-semibold mt-2">{rate >= 10 ? rate.toFixed(2) : rate >= 1 ? rate.toFixed(3) : rate.toFixed(4)}</div>
              <div className={`text-xs font-semibold mt-1 ${chColor}`}>{ch > 0 ? "+" : ""}{ch.toFixed(2)}%</div>
              <Sparkline values={hist} color="#0F52BA" currency={code} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

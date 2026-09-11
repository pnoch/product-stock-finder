import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../hooks/use-theme";
import { convertPrice, CURRENCY_SYMBOLS } from "@shared/currency";
import type { PricePoint } from "../../../lib/types";

export function PriceHistoryChart({
  history,
  displayCurrency,
}: {
  history: PricePoint[];
  displayCurrency: string;
}) {
  const { isDark } = useTheme();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={history.map((p) => ({
          date: new Date(p.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          price: convertPrice(p.price, p.currency, displayCurrency),
        }))}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }} axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} />
        <YAxis
          tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }}
          axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
          tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
          tickFormatter={(v: number) =>
            `${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${v.toFixed(0)}`
          }
        />
        <Tooltip
          cursor={{ stroke: isDark ? "#3B7DD8" : "#0F52BA", strokeDasharray: "4 4", strokeOpacity: 0.3 }}
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;
            return (
              <div
                className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs"
                style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}
              >
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
                {payload.map((entry: any, idx: number) => (
                  <p
                    key={idx}
                    className="flex items-center gap-2 animate-fadeIn"
                    style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? (isDark ? "#3B7DD8" : "#0F52BA") }} />
                    <span className="text-gray-500 dark:text-gray-400">{entry.name ?? "Price"}:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {`${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${Number(entry.value).toFixed(2)}`}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke={isDark ? "#3B7DD8" : "#0F52BA"}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

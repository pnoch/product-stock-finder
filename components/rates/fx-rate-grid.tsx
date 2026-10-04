import { View } from "react-native";
import { EXCHANGE_RATES } from "@shared/currency";
import { FxSparklineCard } from "./fx-sparkline-card";

const CURRENCIES = [
  "USD", "EUR", "GBP", "MYR", "AUD", "NZD",
  "CAD", "ZAR", "THB", "SGD", "HKD", "AED",
];

interface FxRateGridProps {
  currentRates: Record<string, number>;
  history: Record<string, (number | null)[]>;
  change: Record<string, number | null>;
}

export function FxRateGrid({ currentRates, history, change }: FxRateGridProps) {
  const currencies = CURRENCIES;

  const rows: string[][] = [];
  for (let i = 0; i < currencies.length; i += 2) {
    rows.push(currencies.slice(i, i + 2));
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((code) => (
            <FxSparklineCard
              key={code}
              currency={code}
              rate={currentRates[code] ?? EXCHANGE_RATES[code] ?? 1}
              change={change[code] ?? 0}
              history={history[code] ?? []}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

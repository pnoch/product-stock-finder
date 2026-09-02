import { View } from "react-native";
import { FxSparklineCard } from "./fx-sparkline-card";

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

interface FxRateGridProps {
  currentRates: Record<string, number>;
  history: Record<string, (number | null)[]>;
  change: Record<string, number>;
}

export function FxRateGrid({ currentRates, history, change }: FxRateGridProps) {
  const currencies = Object.keys(CURRENCY_INFO);

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
              flag={CURRENCY_INFO[code]?.flag ?? ""}
              rate={currentRates[code] ?? 1}
              change={change[code] ?? 0}
              history={history[code] ?? []}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

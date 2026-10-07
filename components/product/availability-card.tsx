import type { JSX } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  scarcityColorToken,
  scarcityLabel,
  type Availability,
} from "@/lib/availability";

const DAY_MS = 24 * 60 * 60 * 1000;

// Not formatRelativeTime(): it switches to "Nd ago" then an absolute date at
// >=7d, but the "Last seen ..." clause wants the readable long form ("8 days ago").
function relativeDays(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / DAY_MS);
  if (days < 1) return "today";
  return `${days} days ago`;
}

export function AvailabilityCard({ data }: { data: Availability }): JSX.Element {
  const colors = useColors();
  const scarcityColor = colors[scarcityColorToken(data.scarcity)];

  const clauses = [
    `In stock ${Math.round(data.inStockRate * 100)}% of the time`,
    data.lastInStockAt !== null ? `Last seen ${relativeDays(data.lastInStockAt)}` : null,
    data.typicalRestockDays !== null
      ? `Typically restocks ~every ${Math.round(data.typicalRestockDays)} days`
      : null,
  ].filter((clause): clause is string => clause !== null);

  const a11yLabel = `${scarcityLabel(data.scarcity)} — ${clauses.join(". ")}`;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 6,
      }}
      accessibilityLabel={a11yLabel}
    >
      <Text style={{ color: scarcityColor, fontSize: 16, fontWeight: "700" }}>
        {scarcityLabel(data.scarcity)}
      </Text>
      <Text style={{ color: colors.foreground, fontSize: 13 }}>
        In stock {Math.round(data.inStockRate * 100)}% of the time
      </Text>
      {data.lastInStockAt !== null ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Last seen {relativeDays(data.lastInStockAt)}
        </Text>
      ) : null}
      {data.typicalRestockDays !== null ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Typically restocks ~every {Math.round(data.typicalRestockDays)} days
        </Text>
      ) : null}
    </View>
  );
}

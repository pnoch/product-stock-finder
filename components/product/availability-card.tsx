import type { JSX } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { Availability, Scarcity } from "@/lib/availability";

const SCARCITY_COPY: Record<Scarcity, string> = {
  rare: "Rare",
  occasional: "Occasional",
  common: "Usually available",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function relativeDays(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / DAY_MS);
  if (days < 1) return "today";
  return `${days} days ago`;
}

export function AvailabilityCard({ data }: { data: Availability }): JSX.Element {
  const colors = useColors();
  const scarcityColor =
    data.scarcity === "rare"
      ? colors.error
      : data.scarcity === "occasional"
        ? colors.warning
        : colors.success;

  const clauses = [
    `In stock ${Math.round(data.inStockRate * 100)}% of the time`,
    data.lastInStockAt !== null ? `Last seen ${relativeDays(data.lastInStockAt)}` : null,
    data.typicalRestockDays !== null
      ? `Typically restocks ~every ${Math.round(data.typicalRestockDays)} days`
      : null,
  ].filter((clause): clause is string => clause !== null);

  const a11yLabel = `${SCARCITY_COPY[data.scarcity]} — ${clauses.join(". ")}`;

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
        {SCARCITY_COPY[data.scarcity]}
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

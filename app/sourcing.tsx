import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SourcingSheet } from "@/components/sourcing/sourcing-sheet";
import { goBackOrHome } from "@/lib/navigation";
import { getSettings, getWatchlist } from "@/lib/storage";
import { formatEstimate } from "@/lib/estimate-format";
import { CURRENCY_SYMBOLS } from "@shared/currency";
import {
  computeSourcing,
  type SourcingLine,
  type SourcingSummary,
} from "@/lib/reseller";
import type { LandedCostOptions, Destination } from "@/lib/landed-cost";
import type { Product } from "@/lib/types";

function money(amount: number | null, currency: string): string {
  return amount == null ? "—" : formatEstimate(amount, currency);
}

function spreadLabel(line: SourcingLine): string {
  if (line.spreadMin == null || line.spreadMax == null) return "—";
  const symbol = CURRENCY_SYMBOLS[line.currency] ?? line.currency;
  const gap = /^[A-Z]{3}$/.test(symbol) ? " " : "";
  const lo = Math.round(line.spreadMin);
  const hi = Math.round(line.spreadMax);
  return `${symbol}${gap}${lo}–${symbol}${gap}${hi}`;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontSize: 15,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 12 }}>{value}</Text>
    </View>
  );
}

function LineCard({
  line,
  onEdit,
}: {
  line: SourcingLine;
  onEdit: (line: SourcingLine) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
        {line.productName}
      </Text>
      <DetailRow label="Qty" value={String(line.quantity)} />
      <DetailRow label="Buy / unit" value={money(line.buyUnit, line.currency)} />
      <DetailRow label="Sell / unit" value={money(line.sellUnit, line.currency)} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>Margin / unit</Text>
        <Text
          style={{
            color: line.marginUnit != null && line.marginUnit < 0 ? colors.error : colors.success,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {money(line.marginUnit, line.currency)}
        </Text>
      </View>
      <DetailRow label="Margin total" value={money(line.marginTotal, line.currency)} />
      <DetailRow label="Spread" value={spreadLabel(line)} />
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onEdit(line)}
        accessibilityRole="button"
        accessibilityLabel={`Set sell price for ${line.productName}`}
        style={{ marginTop: 8 }}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
          Set sell price
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryCard({ summary }: { summary: SourcingSummary }) {
  return (
    <Card title="Summary">
      <DetailRow label="Total outlay" value={formatEstimate(summary.totalOutlay, summary.currency)} />
      <DetailRow label="Total margin" value={money(summary.totalMargin, summary.currency)} />
    </Card>
  );
}

export default function SourcingScreen() {
  const colors = useColors();
  const router = useRouter();

  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [options, setOptions] = useState<LandedCostOptions>({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<SourcingLine | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [items, settings] = await Promise.all([getWatchlist(), getSettings()]);
      if (!active) return;
      setWatchlist(items as Product[]);
      setDestination(
        settings?.shipToCountry
          ? {
              countryCode: settings.shipToCountry,
              currency: settings.displayCurrency ?? "USD",
            }
          : null,
      );
      setOptions({
        taxExempt: settings?.taxExempt,
        includeImportEstimate: settings?.includeImportEstimate,
      });
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () =>
      destination ? computeSourcing(watchlist, destination, options) : null,
    [watchlist, destination, options],
  );

  const editingProduct = editing
    ? watchlist.find((p) => p.id === editing.productId)
    : undefined;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: "Sourcing sheet" }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
          gap: 12,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => goBackOrHome(router)}
          style={{ padding: 4 }}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Sourcing sheet
        </Text>

        {loaded && !destination ? (
          <Card title="Set where you ship to">
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
              We need a destination country to estimate landed costs and margins
              for your watchlist.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push("/(tabs)/settings")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 10,
              }}
            >
              <IconSymbol name="gearshape.fill" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                Open settings
              </Text>
            </Pressable>
          </Card>
        ) : summary ? (
          <>
            {summary.lines.map((line) => (
              <LineCard key={line.productId} line={line} onEdit={setEditing} />
            ))}
            <SummaryCard summary={summary} />
          </>
        ) : null}
      </ScrollView>

      {editing && editingProduct ? (
        <SourcingSheet
          visible
          productId={editing.productId}
          productName={editing.productName}
          quantity={editingProduct.quantity}
          targetSellPrice={editingProduct.targetSellPrice}
          currency={destination?.currency ?? "USD"}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}
    </ScreenContainer>
  );
}

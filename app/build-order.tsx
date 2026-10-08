import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSettings, getWatchlist } from "@/lib/storage";
import { formatEstimate } from "@/lib/estimate-format";
import {
  computeBuildOrder,
  type BuildOrderComparison,
  type BuildOrderPlan,
  type BuildOrderStore,
} from "@/lib/build-order";
import type { LandedCostOptions, Destination } from "@/lib/landed-cost";
import type { Product } from "@/lib/types";

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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

function PlanSummary({
  plan,
  storeLabel,
}: {
  plan: BuildOrderPlan;
  storeLabel: string;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.foreground, fontSize: 14, marginBottom: 6 }}>
        {storeLabel}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        {formatEstimate(plan.itemsTotal, plan.currency)} +{" "}
        {formatEstimate(plan.shippingTotal, plan.currency)} ={" "}
        {formatEstimate(plan.total, plan.currency)}
      </Text>
    </View>
  );
}

function StoreBreakdown({
  store,
  currency,
}: {
  store: BuildOrderStore;
  currency: string;
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
        {store.distributorName}
      </Text>
      {store.items.map((item) => (
        <View
          key={`${store.distributorId}-${item.productId}`}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>
            {item.productName}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13 }}>
            {formatEstimate(item.itemCost, currency)}
          </Text>
        </View>
      ))}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>Subtotal</Text>
        <Text style={{ color: colors.foreground, fontSize: 12 }}>
          {formatEstimate(store.itemsTotal, currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Shipping</Text>
        <Text style={{ color: colors.foreground, fontSize: 12 }}>
          {formatEstimate(store.shipping, currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
          Total
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
          {formatEstimate(store.total, currency)}
        </Text>
      </View>
    </View>
  );
}

function verdictLine(comparison: BuildOrderComparison): string {
  const { singleStore, savings } = comparison;
  if (!singleStore) {
    // No store carries everything, so the split is the only option — not a tie.
    return "No single store has everything — the split order is the way to go";
  }
  if (savings > 0) {
    return `Order everything from ${singleStore.stores[0]!.distributorName} and save ${formatEstimate(savings, singleStore.currency)}`;
  }
  if (savings < 0) {
    return `Splitting saves ${formatEstimate(-savings, singleStore.currency)}`;
  }
  return "Similar cost either way";
}

export default function BuildOrderScreen() {
  const colors = useColors();
  const router = useRouter();

  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [options, setOptions] = useState<LandedCostOptions>({});
  const [loaded, setLoaded] = useState(false);

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

  const comparison = useMemo(
    () =>
      destination ? computeBuildOrder(watchlist, destination, options) : null,
    [watchlist, destination, options],
  );

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: "Plan order" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Plan order
        </Text>

        {loaded && !destination ? (
          <Card title="Set where you ship to">
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
              We need a destination country to estimate shipping and duties for
              your watchlist.
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
        ) : comparison ? (
          <>
            <Card title="Cheapest single order">
              {comparison.singleStore ? (
                <PlanSummary
                  plan={comparison.singleStore}
                  storeLabel={`${comparison.singleStore.stores[0]!.distributorName} · ${comparison.singleStore.stores[0]!.items.length} items`}
                />
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  No single store has everything
                </Text>
              )}
            </Card>

            <Card title="Cheapest split">
              <PlanSummary
                plan={comparison.split}
                storeLabel={`${comparison.split.stores.length} ${
                  comparison.split.stores.length === 1 ? "store" : "stores"
                }`}
              />
            </Card>

            <Card title="Verdict">
              <Text style={{ color: colors.foreground, fontSize: 14 }}>
                {verdictLine(comparison)}
              </Text>
            </Card>

            <Text
              style={{
                color: colors.foreground,
                fontSize: 16,
                fontWeight: "700",
                marginTop: 4,
                marginBottom: 8,
              }}
            >
              Per-store breakdown
            </Text>
            {comparison.split.stores.map((store) => (
              <StoreBreakdown
                key={store.distributorId}
                store={store}
                currency={comparison.split.currency}
              />
            ))}

            {comparison.split.unassigned.length > 0 && (
              <Card title="Unassigned parts">
                {comparison.split.unassigned.map((id) => (
                  <Text
                    key={id}
                    style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}
                  >
                    {watchlist.find((p) => p.id === id)?.name ?? id}
                  </Text>
                ))}
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

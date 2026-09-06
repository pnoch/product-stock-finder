import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, getSettings } from "@/lib/storage";
import { getDistributorById } from "@shared/distributors";
import {
  analyzeDistributors,
  DistributorAnalysis,
} from "@/lib/distributor-analysis";
import { formatPrice } from "@shared/currency";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { SkeletonList } from "@/components/ui/skeleton";

export default function DistributorAnalysisScreen() {
  const colors = useColors();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const watchlist = await getWatchlist();
      const settings = await getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity activeOpacity={0.85}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          Distributor Analysis
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <EmptyStateView
          icon="exclamationmark.triangle"
          title="Failed to load analysis"
          subtitle={error}
          ctaLabel="Retry"
          onCtaPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            loadData();
          }}
          secondaryLabel="Browse Products"
          onSecondaryPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/search");
          }}
        />
      ) : analysis.length === 0 ? (
        <EmptyStateView
          icon="chart.bar.fill"
          title="No distributor data yet"
          subtitle="Add a few products to your watchlist to compare coverage and average prices across distributors."
          ctaLabel="Browse Products"
          onCtaPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/search");
          }}
          secondaryLabel="Try Again"
          onSecondaryPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            loadData();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          {analysis.map((a, idx) => {
            const distrib = getDistributorById(a.distributorId);
            return (
              <View
                key={a.distributorId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: idx === analysis.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    {`${distrib?.countryFlag ?? ""} ${distrib?.name ?? a.distributorId}`.trim()}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg{" "}
                    {formatPrice(a.averagePrice, displayCurrency)} (incl. tax)
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {formatPrice(a.totalCost, displayCurrency)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

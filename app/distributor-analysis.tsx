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
import { distributorAnalysisToCsv } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";
import { showAlert } from "@/lib/alert";
import { goBackOrHome } from "@/lib/navigation";
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

  const handleExport = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (analysis.length === 0) {
        showAlert("Nothing to export", "Add a product to your watchlist first.");
        return;
      }
      // Export the analysis itself (coverage/avg/total per distributor), not
      // the watchlist listing rows.
      const csv = distributorAnalysisToCsv(analysis, displayCurrency);
      // Shared helper: web downloads a .csv file, native writes it to the cache
      // dir and opens the share sheet. The previous text-share path only sent
      // the CSV as a message, so the recipient got text instead of a file.
      const ok = await exportCsvFile(csv, `distributor-analysis-${new Date().toISOString().slice(0, 10)}.csv`);
      if (!ok) {
        showAlert("Export unavailable", "We couldn't export the analysis on this device.");
        return;
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Exported", "The distributor analysis CSV has been created.");
    } catch (e) {
      showAlert("Export failed", e instanceof Error ? e.message : "Couldn't export the analysis.");
    }
  }, [analysis, displayCurrency]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <TouchableOpacity activeOpacity={0.85}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // A deep-linked cold start has no history, where a bare back()
            // silently does nothing; fall back to a safe route.
            goBackOrHome(router, "/(tabs)/watchlist");
          }}
          style={{ marginRight: 12 }}
          hitSlop={12}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          Distributor Analysis
        </Text>
        </View>
        {analysis.length > 0 && (
          <TouchableOpacity activeOpacity={0.85}
            onPress={handleExport}
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
            accessibilityLabel="Export CSV"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Export CSV</Text>
          </TouchableOpacity>
        )}
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
                    {`${distrib?.countryCode ?? ""} ${distrib?.name ?? a.distributorId}`.trim()}
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

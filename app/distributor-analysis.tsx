import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, getSettings } from "@/lib/storage";
import { getDistributorById } from "@/lib/distributors";
import {
  analyzeDistributors,
  DistributorAnalysis,
} from "@/lib/distributor-analysis";
import { formatPrice } from "@/lib/currency";

export default function DistributorAnalysisScreen() {
  const colors = useColors();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const watchlist = await getWatchlist();
      const settings = await getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
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
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
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
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : analysis.length === 0 ? (
        <Text
          style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
        >
          Add products to see distributor analysis.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          {analysis.map((a) => {
            const distrib = getDistributorById(a.distributorId);
            return (
              <View
                key={a.distributorId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
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
                    {distrib?.countryFlag} {distrib?.name ?? a.distributorId}
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

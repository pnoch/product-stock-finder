import { useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { useToast } from "@/components/ui/toast";
import { useSettings } from "@/lib/settings-provider";
import { useDropsData, type DropsTab } from "@/hooks/use-drops-data";
import { DropsHeader } from "@/components/drops/drops-header";
import { DropsControls } from "@/components/drops/drops-controls";
import { DropRow } from "@/components/drops/drop-row";
import type { DropSortBy, DropWindow } from "@/lib/price-leaderboard";

export default function DropsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const displayCurrency = settings.displayCurrency;
  const [window, setWindow] = useState<DropWindow>("7d");
  const [sortBy, setSortBy] = useState<DropSortBy>("pct");
  const [tab, setTab] = useState<DropsTab>("your");

  const { visibleDrops, loading, handleRowPress, handleShare, selectTab } =
    useDropsData({
      window,
      sortBy,
      tab,
      setTab,
      isAuthenticated,
      displayCurrency,
      showToast,
    });

  return (
    <ScreenContainer>
      <DropsHeader
        colors={colors}
        onBack={() => router.back()}
        onShare={() => void handleShare()}
      />

      <DropsControls
        colors={colors}
        window={window}
        onWindow={setWindow}
        sortBy={sortBy}
        onSortBy={setSortBy}
        tab={tab}
        onTab={selectTab}
        isAuthenticated={isAuthenticated}
      />

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 60,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
            Loading drops...
          </Text>
        </View>
      ) : visibleDrops.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <EmptyStateView
            icon="chart.line.downtrend.xyaxis"
            title={tab === "your" ? "No drops this period" : "No drops found"}
            subtitle={
              tab === "your"
                ? "No drops this period — add products to your watchlist to track them"
                : "No drops found — try a longer time range"
            }
            ctaLabel={tab === "your" ? "Browse Products" : undefined}
            onCtaPress={tab === "your" ? () => router.push("/search") : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={visibleDrops}
          keyExtractor={(item) => `${item.productId}:${item.distributorId}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <DropRow drop={item} colors={colors} onPress={() => handleRowPress(item)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

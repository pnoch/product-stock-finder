import { useState } from "react";
import { ScrollView, View, Text, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { TrendingSection } from "@/components/home/trending-section";
import { AvailableSection } from "@/components/home/available-section";
import { FacebookSearchSheet } from "@/components/marketplace/facebook-search-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";

function FacebookSearchEntry() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Search Facebook Marketplace"
        onPress={() => setVisible(true)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: colors.surface, borderRadius: 16, borderWidth: 0.5,
          borderColor: colors.border, padding: 14,
        }}
      >
        <IconSymbol size={20} name="magnifyingglass" color={colors.tint} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
            Search Facebook Marketplace
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            Local listings — sign in inside the app browser
          </Text>
        </View>
      </TouchableOpacity>
      <FacebookSearchSheet visible={visible} onClose={() => setVisible(false)} />
    </View>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setRefreshKey((k) => k + 1);
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ paddingTop: 16 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 28,
            fontWeight: "700",
            marginBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          Discover
        </Text>
        <CatalogSearchBar
          key={`search-${refreshKey}`}
          query={query}
          onQueryChange={setQuery}
          onSearchSubmit={() => router.push("/search")}
        />
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <FacebookSearchEntry />
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <TrendingSection key={`trending-${refreshKey}`} />
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 24 }}>
        <AvailableSection key={`available-${refreshKey}`} />
      </View>
    </ScrollView>
  );
}

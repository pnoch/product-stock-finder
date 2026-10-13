import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import SearchScreen from "@/app/search";
import { TrendingSection } from "@/components/home/trending-section";
import { AvailableSection } from "@/components/home/available-section";
import { FacebookSearchSheet } from "@/components/marketplace/facebook-search-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";

function FacebookSearchEntry({ query }: { query: string }) {
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
      <FacebookSearchSheet visible={visible} initialQuery={query} onClose={() => setVisible(false)} />
    </View>
  );
}

export default function DiscoverScreen() {
  return (
    <SearchScreen mode="discover" renderBrowse={(query) => (
      <View>
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <FacebookSearchEntry query={query} />
        </View>
        {!query.trim() && <View>
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <TrendingSection />
          </View>
          <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 24 }}>
            <AvailableSection />
          </View>
        </View>}
      </View>
    )} />
  );
}

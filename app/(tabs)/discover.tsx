import { View } from "react-native";
import SearchScreen from "@/app/search";
import { TrendingSection } from "@/components/home/trending-section";
import { AvailableSection } from "@/components/home/available-section";

export default function DiscoverScreen() {
  return (
    <SearchScreen
      mode="discover"
      renderBrowse={(query) =>
        !query.trim() ? (
          <View>
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <TrendingSection />
            </View>
            <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 24 }}>
              <AvailableSection />
            </View>
          </View>
        ) : null
      }
    />
  );
}
import { View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { SkeletonList } from "@/components/ui/skeleton";

export function WatchlistLoadingSkeleton() {
  const colors = useColors();
  return (
    <ScreenContainer>
      <View style={{ paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 120,
              height: 20,
              borderRadius: 8,
              backgroundColor: colors.border,
              opacity: 0.5,
            }}
          />
          <View
            style={{
              width: 80,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.border,
              opacity: 0.5,
            }}
          />
        </View>
        <SkeletonList count={4} />
      </View>
    </ScreenContainer>
  );
}

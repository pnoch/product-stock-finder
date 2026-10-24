import { Text, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function DistributorListingEmpty({
  colors,
  hasListings,
  regionFilter,
  findingPrices,
  findingProgress,
  watchingAny,
  onFindPrices,
  onWatchAny,
  onShowAll,
}: {
  colors: Colors;
  hasListings: boolean;
  regionFilter: string;
  findingPrices: boolean;
  findingProgress?: { done: number; total: number } | null;
  watchingAny: boolean;
  onFindPrices?: () => void;
  onWatchAny?: () => void;
  onShowAll: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 14 }}>
        {hasListings ? `No distributors in ${regionFilter}.` : "No distributor data available yet."}
      </Text>
      {!hasListings && onFindPrices && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onFindPrices}
          disabled={findingPrices}
          style={{
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: colors.primary,
            opacity: findingPrices ? 0.6 : 1,
          }}
          accessibilityLabel="Find prices"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            {findingPrices
              ? findingProgress
                ? `Finding prices… ${findingProgress.done}/${findingProgress.total}`
                : "Finding prices…"
              : "Find prices"}
          </Text>
        </TouchableOpacity>
      )}
      {!hasListings && onWatchAny && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onWatchAny}
          style={{
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: watchingAny ? colors.success : colors.primary,
          }}
          accessibilityLabel={watchingAny ? "Stop watching all distributors" : "Watch for restock across all distributors"}
          accessibilityRole="button"
        >
          <Text style={{ color: watchingAny ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
            {watchingAny ? "Watching — tap to stop" : "Watch anyway"}
          </Text>
        </TouchableOpacity>
      )}
      {hasListings && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onShowAll}
          style={{
            marginTop: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: colors.primary,
          }}
          accessibilityLabel="Show all regions"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            Show All
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

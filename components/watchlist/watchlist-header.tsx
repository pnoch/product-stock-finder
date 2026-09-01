import { Text, View, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type WatchlistHeaderProps = {
  mode: "normal" | "selection";
  selectedCount: number;
  watchlistLength: number;
  filteredCount?: number;
  isRefreshingAny: boolean;
  checking: boolean;
  checkProgress?: { current: number; total: number } | null;
  onAnalysis: () => void;
  onRefresh: () => void;
  onCheckNow: () => void;
  onAdd: () => void;
  onBulkDelete: () => void;
  onBulkTag: () => void;
  onExitSelection: () => void;
};

export function WatchlistHeader({
  mode,
  selectedCount,
  watchlistLength,
  filteredCount,
  isRefreshingAny,
  checking,
  checkProgress,
  onAnalysis,
  onRefresh,
  onCheckNow,
  onAdd,
  onBulkDelete,
  onBulkTag,
  onExitSelection,
}: WatchlistHeaderProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  if (mode === "selection") {
    return (
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {selectedCount} selected
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Tap to toggle</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity activeOpacity={0.85}
            onPress={onBulkDelete}
            style={{
              backgroundColor: colors.error,
              borderRadius: 20,
              paddingHorizontal: 14,
              minHeight: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            accessibilityLabel="Delete selected"
            accessibilityRole="button"
            accessibilityHint="Double tap to delete"
          >
            <IconSymbol name="trash.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              Delete
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85}
            onPress={onBulkTag}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              paddingHorizontal: 14,
              minHeight: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            accessibilityLabel="Tag selected"
            accessibilityRole="button"
          >
            <IconSymbol name="tag.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              Tag
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onExitSelection}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              width: 40,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityLabel="Exit selection mode"
            accessibilityRole="button"
            accessibilityHint="Dismisses selection mode"
          >
            <IconSymbol name="xmark" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="px-5 pt-4 pb-2 flex-row items-center justify-between" style={{ flexWrap: "wrap", gap: 8 }}>
      <View style={{ flexShrink: 1 }}>
        <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
        <Text className="text-muted text-sm">
          {watchlistLength} product{watchlistLength !== 1 ? "s" : ""} tracked
          {filteredCount !== undefined && filteredCount !== watchlistLength ? ` · ${filteredCount} shown` : ""}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAnalysis();
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: isCompact ? 10 : 14,
              minHeight: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityLabel="Analysis"
            accessibilityRole="button"
          >
          <IconSymbol
            name="chart.bar.xaxis"
            size={16}
            color={colors.primary}
          />
          {!isCompact && (
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
            >
              Analysis
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRefresh();
          }}
          disabled={isRefreshingAny}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: isCompact ? 10 : 14,
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityLabel="Refresh all prices"
          accessibilityRole="button"
          accessibilityState={{ disabled: isRefreshingAny }}
        >
          {isRefreshingAny ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol
              name="arrow.clockwise"
              size={16}
              color={colors.primary}
            />
          )}
          {!isCompact && (
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
            >
              Refresh all
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85}
          style={{
            backgroundColor: checking ? colors.muted : colors.primary,
            borderRadius: 20,
            paddingHorizontal: isCompact ? 10 : 14,
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: watchlistLength === 0 ? 0.5 : 1,
          }}
          onPress={onCheckNow}
          disabled={checking || watchlistLength === 0}
          accessibilityLabel="Check now"
          accessibilityRole="button"
          accessibilityState={{ disabled: checking || watchlistLength === 0 }}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconSymbol name="arrow.clockwise" size={16} color="#fff" />
          )}
          {!isCompact && (
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              {checkProgress
                ? `Checking ${checkProgress.current}/${checkProgress.total}`
                : "Check Now"}
            </Text>
          )}
        </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              width: 40,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAdd();
            }}
            accessibilityLabel="Add product"
            accessibilityRole="button"
          >
          <IconSymbol name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

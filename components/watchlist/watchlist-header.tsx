import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type WatchlistHeaderProps = {
  mode: "normal" | "selection";
  selectedCount: number;
  watchlistLength: number;
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

  if (mode === "selection") {
    return (
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">
            {selectedCount} Selected
          </Text>
          <Text className="text-muted text-sm">Tap products to select</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={onBulkDelete}
            style={{
              backgroundColor: colors.error,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol name="trash.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              Delete
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onBulkTag}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol name="tag.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              Tag
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onExitSelection}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="xmark" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
      <View>
        <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
        <Text className="text-muted text-sm">
          {watchlistLength} product
          {watchlistLength !== 1 ? "s" : ""} tracked
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAnalysis();
          }}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: 14,
            height: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <IconSymbol
            name="chart.bar.xaxis"
            size={16}
            color={colors.primary}
          />
          <Text
            style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
          >
            Analysis
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRefresh();
          }}
          disabled={isRefreshingAny}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            paddingHorizontal: 14,
            height: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}
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
          <Text
            style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
          >
            Refresh all
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: checking ? colors.muted : colors.primary,
            borderRadius: 20,
            paddingHorizontal: 14,
            height: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: watchlistLength === 0 ? 0.5 : 1,
          }}
          onPress={onCheckNow}
          disabled={checking || watchlistLength === 0}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconSymbol name="arrow.clockwise" size={16} color="#fff" />
          )}
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            {checkProgress
              ? `Checking ${checkProgress.current}/${checkProgress.total}`
              : "Check Now"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdd();
          }}
        >
          <IconSymbol name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

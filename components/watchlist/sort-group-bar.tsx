import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  SORT_OPTIONS,
  GROUP_OPTIONS,
  type WatchlistSort,
  type WatchlistGroup,
} from "@/lib/watchlist-org";

export function SortGroupBar({
  sortMode,
  groupMode,
  sortMenuOpen,
  onSortModeChange,
  onGroupModeChange,
  onSortMenuToggle,
}: {
  sortMode: WatchlistSort;
  groupMode: WatchlistGroup;
  sortMenuOpen: boolean;
  onSortModeChange: (mode: WatchlistSort) => void;
  onGroupModeChange: (mode: WatchlistGroup) => void;
  onSortMenuToggle: () => void;
}) {
  const colors = useColors();

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSortMenuToggle();
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityLabel={`Sort: ${SORT_OPTIONS.find((o) => o.key === sortMode)?.label}`}
          accessibilityRole="button"
        >
          <Text
            style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}
          >
            Sort: {SORT_OPTIONS.find((o) => o.key === sortMode)?.label}
          </Text>
          <IconSymbol name="chevron.down" size={12} color={colors.muted} />
        </TouchableOpacity>
        {GROUP_OPTIONS.map((opt) => {
          const active = groupMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onGroupModeChange(opt.key);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
              accessibilityLabel={`Group by ${opt.label}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.muted,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {sortMenuOpen && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSortModeChange(opt.key);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: active
                    ? colors.primary + "18"
                    : "transparent",
                }}
                accessibilityLabel={`Sort by ${opt.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.foreground,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
}

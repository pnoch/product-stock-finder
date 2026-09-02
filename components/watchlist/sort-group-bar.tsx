import { Text, View, TouchableOpacity, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  SORT_OPTIONS,
  GROUP_OPTIONS,
  type WatchlistSort,
  type WatchlistGroup,
} from "@/lib/watchlist-org";
import { useRef, useCallback } from "react";

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
  const lastHapticRef = useRef(0);
  const throttledHaptic = useCallback(() => {
    if (Platform.OS === "web") return;
    const now = Date.now();
    if (now - lastHapticRef.current < 300) return;
    lastHapticRef.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View style={{ position: "relative", zIndex: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <TouchableOpacity activeOpacity={0.7}
          onPress={() => {
            throttledHaptic();
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
            <TouchableOpacity activeOpacity={0.85}
              key={opt.key}
              onPress={() => {
                throttledHaptic();
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
        <>
          <Pressable
            onPress={onSortMenuToggle}
            style={{
              position: "absolute",
              top: -1000,
              left: -1000,
              right: -1000,
              bottom: -1000,
              zIndex: 5,
            }}
            accessibilityLabel="Dismiss sort menu"
          />
          <View
            style={{
              position: "absolute",
              top: 40,
              left: 16,
              right: 16,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              zIndex: 10,
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.key;
              return (
                <TouchableOpacity activeOpacity={0.85}
                  key={opt.key}
                  onPress={() => {
                    throttledHaptic();
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
        </>
      )}
    </View>
  );
}

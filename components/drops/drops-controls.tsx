import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { DropSortBy, DropWindow } from "@/lib/price-leaderboard";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;
type DropsTab = "your" | "global";

const WINDOWS: DropWindow[] = ["24h", "7d", "30d"];
const SORTS: { key: DropSortBy; label: string }[] = [
  { key: "pct", label: "%" },
  { key: "abs", label: "Amount" },
];

export function DropsControls({
  colors,
  window,
  onWindow,
  sortBy,
  onSortBy,
  tab,
  onTab,
  isAuthenticated,
}: {
  colors: Colors;
  window: DropWindow;
  onWindow: (window: DropWindow) => void;
  sortBy: DropSortBy;
  onSortBy: (sort: DropSortBy) => void;
  tab: DropsTab;
  onTab: (tab: DropsTab) => void;
  isAuthenticated: boolean;
}) {
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 8,
          gap: 6,
        }}
      >
        {WINDOWS.map((w) => (
          <TouchableOpacity
            key={w}
            activeOpacity={0.7}
            accessibilityLabel={`Show drops from last ${w}`}
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onWindow(w);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: window === w ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: window === w ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: window === w ? "#fff" : colors.foreground,
              }}
            >
              {w}
            </Text>
          </TouchableOpacity>
        ))}
        <View
          style={{
            width: 1,
            backgroundColor: colors.border,
            marginHorizontal: 4,
            marginVertical: 2,
          }}
        />
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            activeOpacity={0.7}
            accessibilityLabel={`Sort by ${s.key === "pct" ? "percentage" : "amount"}`}
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onSortBy(s.key);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: sortBy === s.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: sortBy === s.key ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: sortBy === s.key ? "#fff" : colors.foreground,
              }}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isAuthenticated ? (
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
            gap: 4,
          }}
        >
          {(["your", "global"] as DropsTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              activeOpacity={0.7}
              accessibilityLabel={t === "your" ? "Show your drops" : "Show global drops"}
              accessibilityRole="button"
              onPress={() => onTab(t)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: tab === t ? colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: tab === t ? "#fff" : colors.foreground,
                }}
              >
                {t === "your" ? "Your Drops" : "Global Drops"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </>
  );
}

import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export type ActiveTab = "alerts" | "reminders" | "notifications";

type TabSwitcherProps = {
  active: ActiveTab;
  counts: Record<ActiveTab, number>;
  onChange: (tab: ActiveTab) => void;
};

const TABS: ActiveTab[] = ["alerts", "reminders", "notifications"];

const TAB_ICONS: Record<ActiveTab, React.ComponentProps<typeof IconSymbol>["name"]> = {
  alerts: "bell.fill",
  reminders: "calendar",
  notifications: "bell.badge.fill",
};

const TAB_LABELS: Record<ActiveTab, string> = {
  alerts: "Alerts",
  reminders: "Reminders",
  notifications: "Notifications",
};

export function TabSwitcher({ active, counts, onChange }: TabSwitcherProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {TABS.map((tab) => (
        <TouchableOpacity activeOpacity={0.85}
          key={tab}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(tab);
          }}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 9,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
            backgroundColor:
              active === tab ? colors.primary : "transparent",
          }}
          accessibilityLabel={`${TAB_LABELS[tab]} tab${active === tab ? ', selected' : ''}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab }}
        >
          <IconSymbol
            name={TAB_ICONS[tab]}
            size={15}
            color={active === tab ? "#fff" : colors.foreground}
            style={active === tab ? undefined : { opacity: 0.55 }}
          />
          <Text
            style={{
              color: active === tab ? "#fff" : colors.foreground,
              opacity: active === tab ? 1 : 0.7,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {TAB_LABELS[tab]}
            {counts[tab] > 0 ? ` (${counts[tab]})` : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

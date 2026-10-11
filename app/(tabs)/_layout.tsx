import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAlertBadge } from "@/hooks/use-alert-badge";

export default function TabLayout() {
  const colors = useColors();
  const alertBadgeCount = useAlertBadge();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  const screenOptions = {
    tabBarActiveTintColor: colors.tint,
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarStyle: {
      paddingTop: 8,
      paddingBottom: bottomPadding,
      height: tabBarHeight,
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 0.5,
    },
  } as const;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watch",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="drops"
        options={{
          title: "Drops",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.downtrend.xyaxis" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bell.fill" color={color} />
          ),
          tabBarBadge: alertBadgeCount > 0 ? alertBadgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: "#fff",
            fontSize: 11,
          },
        }}
      />
      <Tabs.Screen
        name="rates"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

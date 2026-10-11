import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";

const ROWS: { icon: IconSymbolName; title: string; subtitle: string; href: "/stats" | "/(tabs)/rates" | "/health" | "/diagnostics" | "/(tabs)/settings" }[] = [
  { icon: "chart.bar.fill", title: "Statistics", subtitle: "Movers, basket, insights", href: "/stats" },
  { icon: "dollarsign.circle.fill", title: "Exchange rates", subtitle: "Currency trends", href: "/(tabs)/rates" },
  { icon: "heart.fill", title: "Distributor health", subtitle: "Scraper status", href: "/health" },
  { icon: "bell.badge.fill", title: "Push diagnostics", subtitle: "Delivery status per device", href: "/diagnostics" },
  { icon: "gearshape.fill", title: "Settings", subtitle: "Account, sync, notifications", href: "/(tabs)/settings" },
];

export default function YouScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, isAuthenticated } = useAuth();
  const displayName = user?.name || user?.email || "Guest";

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}>
            You
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            marginTop: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.primary + "22",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <IconSymbol name="person.crop.circle.fill" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 17 }}>
              {displayName}
            </Text>
            {isAuthenticated && user?.email && user.name ? (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
                {user.email}
              </Text>
            ) : !isAuthenticated ? (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>
                Sign in to sync across devices
              </Text>
            ) : null}
          </View>
          {!isAuthenticated && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(tabs)/settings")}
              accessibilityLabel="Sign in"
              accessibilityRole="button"
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                Sign in
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            marginTop: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {ROWS.map((row) => (
            <TouchableOpacity
              key={row.href}
              activeOpacity={0.7}
              onPress={() => router.push(row.href)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
              accessibilityLabel={row.title}
              accessibilityRole="button"
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.primary + "22",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <IconSymbol name={row.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>
                  {row.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
                  {row.subtitle}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

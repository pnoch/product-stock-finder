import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { useConnection } from "@/hooks/use-connection";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ConnectionBadge } from "@/components/connection-badge";
import { SectionHeader } from "@/components/settings/section-header";
import { formatLastRefreshed } from "@/lib/last-refreshed";

export function ConnectionSection() {
  const colors = useColors();
  const connection = useConnection();

  return (
    <>
      <SectionHeader title="Connection" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <ConnectionBadge status={connection.status} />
          <TouchableOpacity
            disabled={connection.isRefreshing}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              connection.refetch();
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {connection.isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol
                name="arrow.clockwise"
                size={18}
                color={colors.primary}
              />
            )}
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Check Now
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {connection.status === "connected"
            ? "Live price checks are active."
            : connection.status === "signed-out"
              ? "Sign in to sync prices with the backend."
              : "Backend unreachable. Showing saved prices."}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {connection.lastCheckedAt
            ? `Last checked ${formatLastRefreshed(
                new Date(connection.lastCheckedAt).toISOString(),
              )}`
            : "Never checked"}
        </Text>
      </View>
    </>
  );
}

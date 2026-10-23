import { Platform, Pressable, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ConnectionBadge } from "@/components/connection-badge";
import type { ConnectionStatus } from "@/lib/live-prices";

type Monitoring = { status: string };

export function HomeHeader({
  greeting,
  connectionStatus,
  onOpenSettings,
  onOpenProfile,
  onAddProduct,
  monitoring,
  monitoringDismissed,
  onDismissMonitoring,
}: {
  greeting: string;
  connectionStatus: ConnectionStatus;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onAddProduct: () => void;
  monitoring: Monitoring;
  monitoringDismissed: boolean;
  onDismissMonitoring: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">{greeting}</Text>
          <Text className="text-muted text-sm">
            Here&apos;s what needs your attention.
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ConnectionBadge
            status={connectionStatus}
            onPress={
              connectionStatus === "signed-out" || connectionStatus === "local"
                ? onOpenSettings
                : undefined
            }
          />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onOpenProfile}
            accessibilityLabel="Open profile and settings"
            accessibilityRole="button"
            style={{ padding: 10 }}
          >
            <IconSymbol name="gearshape.fill" size={24} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityLabel="Add product"
            accessibilityRole="button"
            style={{
              backgroundColor: colors.primary,
              borderRadius: 22,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAddProduct();
            }}
          >
            <IconSymbol name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {!monitoringDismissed &&
        (monitoring.status === "stopped" || monitoring.status === "stale") && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 16,
              marginBottom: 4,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.warning + "55",
              backgroundColor: colors.warning + "1A",
            }}
          >
            <Pressable
              onPress={onOpenSettings}
              accessibilityRole="button"
              accessibilityLabel="Background monitoring may have stopped. Tap to fix."
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={18}
                color={colors.warning}
              />
              <Text
                style={{ flex: 1, color: colors.foreground, fontSize: 13 }}
              >
                Background monitoring may have stopped — tap to fix.
              </Text>
            </Pressable>
            <Pressable
              onPress={onDismissMonitoring}
              accessibilityRole="button"
              accessibilityLabel="Dismiss monitoring warning"
              hitSlop={8}
            >
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}
    </>
  );
}

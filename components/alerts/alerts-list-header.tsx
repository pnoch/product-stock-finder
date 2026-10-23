import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function AlertsListHeader({
  loadError,
  onRetry,
  activeAlertCount,
}: {
  loadError: string | null;
  onRetry: () => void;
  activeAlertCount: number;
}) {
  const colors = useColors();
  return (
    <>
      {loadError && (
        <View
          style={{
            backgroundColor: colors.error + "15",
            borderRadius: 16,
            padding: 12,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: colors.error + "30",
          }}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={16}
            color={colors.error}
          />
          <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, flex: 1 }}>
            {loadError}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRetry}
            accessibilityLabel="Retry"
            accessibilityRole="button"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: colors.error + "22",
            }}
          >
            <Text
              style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {activeAlertCount > 0 ? (
        <View
          style={{
            backgroundColor: colors.primary + "15",
            borderRadius: 16,
            padding: 12,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconSymbol
            name="info.circle.fill"
            size={18}
            color={colors.primary}
          />
          <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>
            You&apos;ll be notified when a product restocks or drops below your
            target.
          </Text>
        </View>
      ) : null}
    </>
  );
}

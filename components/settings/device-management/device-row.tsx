import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DeviceInfo } from "@/lib/devices";
import { formatLastSeen, platformLabel } from "./device-utils";

interface DeviceRowProps {
  device: DeviceInfo;
  isCurrent: boolean;
  now: number;
  isLast: boolean;
  onRename: (device: DeviceInfo) => void;
  onSignOut: (device: DeviceInfo) => void;
}

export function DeviceRow({
  device,
  isCurrent,
  now,
  isLast,
  onRename,
  onSignOut,
}: DeviceRowProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "500",
              fontSize: 15,
            }}
          >
            {device.label ??
              `${device.deviceId.slice(0, 12)}${device.deviceId.length > 12 ? "…" : ""}`}
          </Text>
          {isCurrent && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
                backgroundColor: colors.primary + "22",
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 10,
                  fontWeight: "600",
                }}
              >
                This device
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 1,
          }}
        >
          {platformLabel(device.platform)} · {formatLastSeen(device.lastSeenAt, now)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => onRename(device)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            backgroundColor: colors.primary + "22",
          }}
          accessibilityLabel="Rename device"
          accessibilityRole="button"
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Rename
          </Text>
        </TouchableOpacity>
        {!isCurrent && (
          <TouchableOpacity
            onPress={() => onSignOut(device)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: colors.error + "22",
            }}
            accessibilityLabel="Sign out device"
            accessibilityRole="button"
          >
            <Text
              style={{
                color: colors.error,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Sign out
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

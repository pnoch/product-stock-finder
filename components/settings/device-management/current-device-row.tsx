import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SettingRow } from "@/components/settings/setting-row";

interface CurrentDeviceRowProps {
  devicesLoading: boolean;
  binding: { userId: number | null } | null;
  userId: number;
  bindingAction: boolean;
  onBind: () => void;
}

export function CurrentDeviceRow({
  devicesLoading,
  binding,
  userId,
  bindingAction,
  onBind,
}: CurrentDeviceRowProps) {
  const colors = useColors();

  return (
    <SettingRow
      icon="iphone"
      label="This device"
      description={
        devicesLoading
          ? "Checking…"
          : binding === null
            ? "Couldn't load device status"
            : binding.userId === userId
              ? "Bound to your account"
              : binding.userId
                ? "Bound to another account"
                : "Not bound to any account"
      }
      descriptionColor={
        binding?.userId === userId
          ? colors.success
          : binding && binding.userId !== null
            ? colors.warning
            : undefined
      }
      right={
        bindingAction ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : binding && binding.userId !== userId ? (
          <TouchableOpacity activeOpacity={0.85}
            onPress={onBind}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: colors.primary + "22",
            }}
            accessibilityLabel="Bind to my account"
            accessibilityRole="button"
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Bind to my account
            </Text>
          </TouchableOpacity>
        ) : undefined
      }
    />
  );
}

import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "@/components/settings/section-header";
import { useDeviceManagement } from "@/components/settings/device-management/use-device-management";
import { RenameDeviceModal } from "@/components/settings/device-management/rename-device-modal";
import { CurrentDeviceRow } from "@/components/settings/device-management/current-device-row";
import { DeviceRow } from "@/components/settings/device-management/device-row";

export function DeviceManagementSection({
  user,
  isAuthenticated,
  colors: colorsProp,
}: {
  user: { id: number } | null | undefined;
  isAuthenticated: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const colors = useColors();
  const {
    devices,
    currentDeviceId,
    currentBinding,
    devicesLoading,
    bindingAction,
    loadDevices,
    handleBindCurrentDevice,
    handleSignOutDevice,
    renameTarget,
    setRenameTarget,
    openRenameModal,
    renameLabel,
    setRenameLabel,
    renaming,
    handleRename,
    now,
  } = useDeviceManagement({ isAuthenticated });

  if (!isAuthenticated || !user) return null;

  return (
    <>
      <SectionHeader title="Device Management" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <CurrentDeviceRow
          devicesLoading={devicesLoading}
          binding={currentBinding}
          userId={user.id}
          bindingAction={bindingAction}
          onBind={handleBindCurrentDevice}
        />
        {devicesLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : devices === null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Couldn&apos;t load devices
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={loadDevices} accessibilityLabel="Retry loading devices" accessibilityRole="button">
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : devices.length === 0 ? (
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              No other devices bound to your account
            </Text>
          </View>
        ) : (
          devices.map((device, idx) => (
            <DeviceRow
              key={device.deviceId}
              device={device}
              isCurrent={device.deviceId === currentDeviceId}
              now={now}
              isLast={idx < devices.length - 1}
              onRename={openRenameModal}
              onSignOut={handleSignOutDevice}
            />
          ))
        )}
      </View>

      {/* Rename Device Modal */}
      <RenameDeviceModal
        target={renameTarget}
        label={renameLabel}
        setLabel={setRenameLabel}
        saving={renaming}
        onSave={handleRename}
        onClose={() => setRenameTarget(null)}
      />
    </>
  );
}

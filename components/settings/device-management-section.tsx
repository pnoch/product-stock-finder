import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "@/components/settings/section-header";
import { useDeviceManagement } from "@/components/settings/device-management/use-device-management";
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
            <TouchableOpacity onPress={loadDevices}>
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
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Rename Device ✏️
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Give this device a friendly name
            </Text>
            <TextInput
              value={renameLabel}
              onChangeText={setRenameLabel}
              placeholder="e.g. Living Room"
              placeholderTextColor={colors.muted}
              maxLength={64}
              autoFocus
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: colors.foreground,
                fontSize: 16,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setRenameTarget(null)}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRename}
                disabled={renaming || !renameLabel.trim()}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: renaming || !renameLabel.trim() ? 0.5 : 1,
                }}
              >
                {renaming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

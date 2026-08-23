import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import {
  fetchDevices,
  fetchCurrentDeviceBinding,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
  bindCurrentDevice,
} from "@/lib/devices";
import type { DeviceInfo } from "@/lib/devices";
import { getDeviceId } from "@/lib/device-id";
import {
  formatLastSeen,
  platformLabel,
} from "@/components/settings/device-management/device-utils";

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
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentBinding, setCurrentBinding] = useState<{
    userId: number | null;
  } | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [bindingAction, setBindingAction] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DeviceInfo | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const [deviceList, binding, deviceId] = await Promise.all([
        fetchDevices(),
        fetchCurrentDeviceBinding(),
        getDeviceId(),
      ]);
      setDevices(deviceList);
      setCurrentBinding(binding);
      setCurrentDeviceId(deviceId);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const handleBindCurrentDevice = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBindingAction(true);
    try {
      await bindCurrentDevice();
      await loadDevices();
    } finally {
      setBindingAction(false);
    }
  }, [loadDevices]);

  const handleSignOutDevice = useCallback(
    (device: DeviceInfo) => {
      const name = device.label ?? `${device.deviceId.slice(0, 12)}…`;
      showAlert(
        "Sign Out Device",
        `Sign out ${name} and remove it from your account? It will be signed out on its next connection.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              await signOutDevice(device.deviceId);
              await loadDevices();
            },
          },
        ],
      );
    },
    [loadDevices],
  );

  const openRenameModal = useCallback((device: DeviceInfo) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRenameTarget(device);
    setRenameLabel(device.label ?? "");
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameTarget) return;
    const label = renameLabel.trim();
    if (!label) return;
    setRenaming(true);
    try {
      await renameDevice(renameTarget.deviceId, label);
      setRenameTarget(null);
      await loadDevices();
    } finally {
      setRenaming(false);
    }
  }, [renameTarget, renameLabel, loadDevices]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      await cleanupStaleDevices();
      await loadDevices();
    })();
  }, [isAuthenticated, loadDevices]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const tick = setInterval(() => {
      if (!cancelled) setNow(Date.now());
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [isAuthenticated]);

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
        <SettingRow
          icon="iphone"
          label="This device"
          description={
            devicesLoading
              ? "Checking…"
              : currentBinding === null
                ? "Couldn't load device status"
                : currentBinding.userId === user.id
                  ? "Bound to your account"
                  : currentBinding.userId
                    ? "Bound to another account"
                    : "Not bound to any account"
          }
          descriptionColor={
            currentBinding?.userId === user.id
              ? colors.success
              : currentBinding && currentBinding.userId !== null
                ? colors.warning
                : undefined
          }
          right={
            bindingAction ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : currentBinding && currentBinding.userId !== user.id ? (
              <TouchableOpacity
                onPress={handleBindCurrentDevice}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: colors.primary + "22",
                }}
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
            <View
              key={device.deviceId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: idx < devices.length - 1 ? 1 : 0,
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
                  {device.deviceId === currentDeviceId && (
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
                  {platformLabel(device.platform)} ·{" "}
                  {formatLastSeen(device.lastSeenAt, now)}
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
                  onPress={() => openRenameModal(device)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
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
                {device.deviceId !== currentDeviceId && (
                  <TouchableOpacity
                    onPress={() => handleSignOutDevice(device)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.error + "22",
                    }}
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

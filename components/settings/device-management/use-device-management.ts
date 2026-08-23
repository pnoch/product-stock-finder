import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
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

export function useDeviceManagement({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
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

  return {
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
  };
}

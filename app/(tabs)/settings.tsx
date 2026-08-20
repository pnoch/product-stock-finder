import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import {
  getSettings,
  saveSettings,
  getWatchlist,
  updateProductListings,
  getSyncMeta,
} from "@/lib/storage";
import { formatSyncStatus, getSyncSetup } from "@/lib/sync";
import { maybeRefreshFxRates } from "@/lib/fx";
import {
  AppSettings,
  Product,
  DistributorListing,
  SyncMeta,
} from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { sendTestNotification } from "@/lib/notifications";
import { setWebNotificationsEnabled } from "@/lib/web-notifications";
import { getDistributorById } from "@/lib/distributors";
import { getAllParserIds } from "@/lib/scrapers/registry";
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
import { ConnectionBadge } from "@/components/connection-badge";
import { useConnection } from "@/hooks/use-connection";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { syncBackgroundTasks } from "@/lib/background-price-check";

function SettingRow({
  icon,
  label,
  description,
  descriptionColor,
  right,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  description?: string;
  descriptionColor?: string;
  right: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
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
        <IconSymbol name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              color: descriptionColor ?? colors.muted,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}

function platformLabel(platform: string | null): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Unknown";
}

function formatLastSeen(lastSeenAt: number, now: number): string {
  if (!lastSeenAt) return "last seen unknown";
  const diff = Math.max(0, now - lastSeenAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
  });
  const [webNotificationHint, setWebNotificationHint] = useState<string | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const { user, isAuthenticated, logout } = useAuth();
  const connection = useConnection();
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
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

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = async () => {
      const meta = await getSyncMeta();
      if (!cancelled) {
        setSyncMeta(meta);
        setNow(Date.now());
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const syncStatus = syncMeta
    ? formatSyncStatus(syncMeta, isAuthenticated, now)
    : isAuthenticated
      ? { label: "Not synced yet", tone: "muted" as const }
      : { label: "Sign in to sync across devices", tone: "muted" as const };

  const handleSyncNow = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await getSyncSetup()?.syncNow();
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      setNow(Date.now());
    } finally {
      setSyncing(false);
    }
  }, []);

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

  const handleSignIn = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startOAuthLogin();
  }, []);

  useEffect(() => {
    getSettings().then(setSettings);
    getWatchlist().then(setProducts);
    void maybeRefreshFxRates();
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await saveSettings(updated);
      if (key === "checkInterval") {
        void syncBackgroundTasks();
      }
    },
    [settings],
  );

  const handleTestNotification = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sent = await sendTestNotification();
    if (!sent) {
      showAlert(
        "Permission Required",
        "Please enable notifications in your device settings to receive stock and price alerts.",
        [{ text: "OK" }],
      );
    }
  }, []);

  const handleReenableDistributor = useCallback(
    async (distributorId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const now = new Date().toISOString();
      for (const product of products) {
        if (!product.listings) continue;
        const updatedListings: DistributorListing[] = product.listings.map(
          (l) =>
            l.distributorId === distributorId ? { ...l, lastChecked: now } : l,
        );
        const changed = updatedListings.some(
          (l, i) => l.lastChecked !== product.listings[i].lastChecked,
        );
        if (changed) {
          await updateProductListings(product.id, updatedListings);
        }
      }
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          listings: p.listings?.map((l) =>
            l.distributorId === distributorId ? { ...l, lastChecked: now } : l,
          ),
        })),
      );
    },
    [products],
  );

  const distributorStatuses = (() => {
    const statuses: Record<
      string,
      {
        lastSuccess: string | null;
        lastError: string | null;
        consecutiveFailures: number;
      }
    > = {};

    // Initialize all parsers as "never checked"
    const parserIds = getAllParserIds();
    for (const id of parserIds) {
      statuses[id] = {
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }

    // Collect lastChecked times from all products' listings
    for (const product of products) {
      if (!product.listings) continue;
      for (const listing of product.listings) {
        const id = listing.distributorId;
        if (!statuses[id]) {
          statuses[id] = {
            lastSuccess: null,
            lastError: null,
            consecutiveFailures: 0,
          };
        }
        // If we have a lastChecked, treat as success
        if (listing.lastChecked) {
          const existing = statuses[id].lastSuccess;
          if (!existing || listing.lastChecked > existing) {
            statuses[id].lastSuccess = listing.lastChecked;
          }
        }
      }
    }

    return statuses;
  })();

  const getDistributorHealth = (
    lastSuccess: string | null,
  ): { label: string; emoji: string; color: string } => {
    if (!lastSuccess) {
      return { label: "Never Checked", emoji: "❓", color: colors.muted };
    }
    const hoursSince =
      (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      return { label: "OK", emoji: "✅", color: colors.success };
    }
    if (hoursSince < 168) {
      return { label: "Stale", emoji: "⚠️", color: colors.warning };
    }
    return { label: "Failed", emoji: "❌", color: colors.error };
  };

  const currencies = [
    "USD",
    "EUR",
    "GBP",
    "MYR",
    "AUD",
    "NZD",
    "CAD",
    "ZAR",
    "THB",
    "SGD",
    "HKD",
    "AED",
  ];
  const regions = [
    "Asia-Pacific",
    "Europe",
    "North America",
    "Middle East",
    "Africa",
  ];
  const intervals = [
    { value: "manual", label: "Manual only" },
    { value: "hourly", label: "Every hour" },
    { value: "daily", label: "Once a day" },
  ];
  const digestFrequencies = [
    { value: "off", label: "Off" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

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

        <SectionHeader title="Account" />
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
          {isAuthenticated && user ? (
            <SettingRow
              icon="person.crop.circle.fill"
              label={user.name ?? "Signed in"}
              description={user.email ?? user.openId}
              right={
                <Text
                  style={{
                    color: colors.success,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Signed in
                </Text>
              }
            />
          ) : (
            <SettingRow
              icon="person.crop.circle.badge.plus"
              label="Sign in to sync"
              description="Sync your watchlist and alerts across devices"
              right={
                <TouchableOpacity
                  onPress={handleSignIn}
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
                    Sign in
                  </Text>
                </TouchableOpacity>
              }
            />
          )}
          <SettingRow
            icon="arrow.triangle.2.circlepath"
            label="Sync status"
            description={syncStatus.label}
            descriptionColor={
              syncStatus.tone === "error"
                ? colors.error
                : syncStatus.tone === "success"
                  ? colors.success
                  : undefined
            }
            right={
              isAuthenticated ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleSyncNow}
                    disabled={syncing}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.primary + "22",
                    }}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        Sync now
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={logout}
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
                </View>
              ) : undefined
            }
          />
        </View>

        {isAuthenticated && user ? (
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
        ) : null}

        <SectionHeader title="Notifications" />
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
            icon="bell.fill"
            label="Enable Notifications"
            description="Receive alerts on your device"
            right={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => updateSetting("notificationsEnabled", v)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "88",
                }}
                thumbColor={
                  settings.notificationsEnabled ? colors.primary : colors.muted
                }
              />
            }
          />
          {Platform.OS === "web" && (
            <>
              <SettingRow
                icon="bell.badge.fill"
                label="Web Notifications"
                description="Show price and stock alerts in your browser"
                right={
                  <Switch
                    value={!!settings.webNotificationsEnabled}
                    onValueChange={(v) => {
                      void setWebNotificationsEnabled(v).then((permission) => {
                        setSettings((prev) => ({
                          ...prev,
                          webNotificationsEnabled: v && permission === "granted",
                        }));
                        if (v && permission !== "granted") {
                          setWebNotificationHint(
                            permission === "denied"
                              ? "Notifications are blocked in your browser settings."
                              : "Allow notifications in your browser to receive alerts.",
                          );
                        } else {
                          setWebNotificationHint(null);
                        }
                      });
                    }}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary + "88",
                    }}
                    thumbColor={
                      settings.webNotificationsEnabled
                        ? colors.primary
                        : colors.muted
                    }
                  />
                }
              />
              {webNotificationHint && (
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: 13,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                  }}
                >
                  {webNotificationHint}
                </Text>
              )}
            </>
          )}
          <SettingRow
            icon="checkmark.circle.fill"
            label="Stock Alerts"
            description="Notify when item comes in stock"
            right={
              <Switch
                value={settings.stockAlerts}
                onValueChange={(v) => updateSetting("stockAlerts", v)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "88",
                }}
                thumbColor={
                  settings.stockAlerts ? colors.primary : colors.muted
                }
              />
            }
          />
          <SettingRow
            icon="tag.fill"
            label="Price Alerts"
            description="Notify when price drops below target"
            right={
              <Switch
                value={settings.priceAlerts}
                onValueChange={(v) => updateSetting("priceAlerts", v)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "88",
                }}
                thumbColor={
                  settings.priceAlerts ? colors.primary : colors.muted
                }
              />
            }
          />
          <SettingRow
            icon="exclamationmark.triangle.fill"
            label="Health Alerts"
            description="Notify when a distributor is blocked or down"
            right={
              <Switch
                value={settings.healthAlerts}
                onValueChange={(v) => updateSetting("healthAlerts", v)}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "88",
                }}
                thumbColor={
                  settings.healthAlerts ? colors.primary : colors.muted
                }
              />
            }
          />
          {/* Test Notification — useful for verifying permissions on device */}
          <TouchableOpacity
            onPress={handleTestNotification}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.success + "22",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <IconSymbol
                name="bell.badge.fill"
                size={18}
                color={colors.success}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "500",
                  fontSize: 15,
                }}
              >
                Test Notification
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
                Send a test alert to verify setup
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <SectionHeader title="Display" />
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
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
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
                <IconSymbol
                  name="dollarsign.circle.fill"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "500",
                  fontSize: 15,
                }}
              >
                Display Currency
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                paddingLeft: 48,
              }}
            >
              {currencies.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => updateSetting("displayCurrency", c)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor:
                      settings.displayCurrency === c
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        settings.displayCurrency === c
                          ? "#fff"
                          : colors.foreground,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <SectionHeader title="Shipping Region" />
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
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
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
                <IconSymbol name="globe" size={18} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "500",
                  fontSize: 15,
                }}
              >
                Shipping Region
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                paddingLeft: 48,
              }}
            >
              {regions.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => updateSetting("shippingRegion", r)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor:
                      (settings.shippingRegion ?? "Asia-Pacific") === r
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        (settings.shippingRegion ?? "Asia-Pacific") === r
                          ? "#fff"
                          : colors.foreground,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <SectionHeader title="Check Interval" />
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
          {intervals.map((interval, idx) => (
            <TouchableOpacity
              key={interval.value}
              onPress={() =>
                updateSetting(
                  "checkInterval",
                  interval.value as AppSettings["checkInterval"],
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: idx < intervals.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 15,
                  }}
                >
                  {interval.label}
                </Text>
              </View>
              {settings.checkInterval === interval.value && (
                <IconSymbol name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="Price Digest" />
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
          {digestFrequencies.map((freq, idx) => (
            <TouchableOpacity
              key={freq.value}
              onPress={() =>
                updateSetting(
                  "digestFrequency",
                  freq.value as AppSettings["digestFrequency"],
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: idx < digestFrequencies.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 15,
                  }}
                >
                  {freq.label}
                </Text>
              </View>
              {(settings.digestFrequency ?? "off") === freq.value && (
                <IconSymbol name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="Scraper Status" />
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
          {Object.entries(distributorStatuses).map(([id, status], idx) => {
            const distributor = getDistributorById(id);
            if (!distributor) return null;
            const health = getDistributorHealth(status.lastSuccess);
            return (
              <View
                key={id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth:
                    idx < Object.keys(distributorStatuses).length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "500",
                        fontSize: 14,
                        marginRight: 6,
                      }}
                    >
                      {distributor.countryFlag} {distributor.name}
                    </Text>
                    <Text style={{ fontSize: 14 }}>{health.emoji}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {status.lastSuccess
                      ? `Last checked: ${new Date(status.lastSuccess).toLocaleDateString()}`
                      : "Never checked"}
                  </Text>
                </View>
                {health.label !== "OK" ? (
                  <TouchableOpacity
                    onPress={() => handleReenableDistributor(id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12,
                      backgroundColor: colors.primary + "22",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      Re-enable
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={{
                      color: health.color,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {health.label}
                  </Text>
                )}
              </View>
            );
          })}
          {Object.keys(distributorStatuses).length === 0 && (
            <View style={{ paddingVertical: 20, paddingHorizontal: 16 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                No distributors configured
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/health")}
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.primary + "22",
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}
          >
            View Health Dashboard
          </Text>
        </TouchableOpacity>

        <SectionHeader title="About" />
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
            icon="info.circle.fill"
            label="Version"
            description="Product Stock Finder"
            right={
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                {Constants.expoConfig?.version ?? "dev"}
              </Text>
            }
          />
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
              )
            }
          >
            <SettingRow
              icon="eye.fill"
              label="Privacy Policy"
              right={
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.muted}
                />
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("mailto:support@productstockfinder.app")
            }
          >
            <SettingRow
              icon="paperplane.fill"
              label="Contact Support"
              right={
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.muted}
                />
              }
            />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 32 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Product Stock Finder · v{Constants.expoConfig?.version ?? "dev"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
            Track smarter. Buy better.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

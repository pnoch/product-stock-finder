import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Platform, ActivityIndicator, Share, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useServerConfig } from "@/hooks/use-server-config";
import {
  getSettings,
  saveSettings,
  getWatchlist,
  updateProductListings,
  getSyncMeta,
} from "@/lib/storage";
import { formatSyncStatus, getSyncSetup } from "@/lib/sync";
import { maybeRefreshFxRates } from "@/lib/fx";
import { AppSettings, Product, DistributorListing, SyncMeta } from "@/lib/types";
import { showAlert } from "@/lib/alert";
import { sendTestNotification } from "@/lib/notifications";
import { syncBackgroundTasks } from "@/lib/background-price-check";

import { ConnectionSection } from "@/components/settings/connection-section";
import { AccountSection } from "@/components/settings/account-section";
import { DeviceManagementSection } from "@/components/settings/device-management-section";
import { DataSection } from "@/components/settings/data-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ScraperStatusSection } from "@/components/settings/scraper-status-section";
import { LlmSettingsSection } from "@/components/settings/llm-settings-section";
import { AboutSection } from "@/components/settings/about-section";
import { LoginModal } from "@/components/settings/login-modal";
import { PillPicker } from "@/components/settings/pill-picker";
import { RadioPicker } from "@/components/settings/radio-picker";
import { SectionHeader } from "@/components/settings/section-header";

function SharedLinksList() {
  const colors = useColors();
  const listQuery = trpc.sharedWatchlists.list.useQuery();
  const extendMutation = trpc.sharedWatchlists.extend.useMutation();
  const revokeMutation = trpc.sharedWatchlists.revoke.useMutation();
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const links = listQuery.data?.links ?? [];

  const runFor = async (token: string, action: "extend" | "revoke" | "copy") => {
    if (busyToken) return;
    if (action === "copy") {
      const link = links.find((l) => l.token === token);
      if (link) await Share.share({ message: link.shareUrl });
      return;
    }
    setBusyToken(token);
    try {
      if (action === "extend") {
        const res = await extendMutation.mutateAsync({ token });
        await listQuery.refetch();
        showAlert("Link extended", `Now expires ${new Date(res.expiresAt).toLocaleDateString()}.`);
      } else {
        await revokeMutation.mutateAsync({ token });
        await listQuery.refetch();
        showAlert("Link revoked", "The share link no longer works.");
      }
    } catch (e) {
      showAlert(action === "extend" ? "Extend failed" : "Revoke failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyToken(null);
    }
  };

  if (listQuery.isLoading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }
  if (listQuery.isError || links.length === 0) return null;

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      {links.map((link) => {
        const busy = busyToken === link.token;
        const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
        return (
          <View
            key={link.token}
            style={{
              backgroundColor: colors.background,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
              {link.title}
            </Text>
            <Text style={{ color: expired ? colors.error : colors.muted, fontSize: 12 }}>
              {link.expiresAt ? `${expired ? "Expired" : "Expires"} ${new Date(link.expiresAt).toLocaleDateString()}` : "No expiry"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(
                [
                  { action: "copy", label: "Copy" },
                  { action: "extend", label: "Extend 30d" },
                  { action: "revoke", label: "Revoke" },
                ] as const
              ).map(({ action, label }) => (
                <TouchableOpacity activeOpacity={0.85}
                  key={action}
                  onPress={() => void runFor(link.token, action)}
                  disabled={busy}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: busy ? 0.5 : 1,
                  }}
                  accessibilityLabel={`${label} share link ${link.title}`}
                  accessibilityRole="button"
                >
                  <Text style={{ color: action === "revoke" ? colors.error : colors.primary, fontSize: 12, fontWeight: "600" }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
function ShareWatchlistButton() {
  const colors = useColors();
  const createMutation = trpc.sharedWatchlists.create.useMutation();
  const [sharing, setSharing] = useState(false);
  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await createMutation.mutateAsync({});
      await Share.share({ message: res.shareUrl });
    } catch (e) {
      showAlert("Share failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [sharing, createMutation]);
  return (
    <TouchableOpacity
      onPress={handleShare}
      disabled={sharing || createMutation.isPending}
      style={{
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        opacity: sharing || createMutation.isPending ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>
        {sharing || createMutation.isPending ? "Creating link…" : "Share watchlist"}
      </Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { configured } = useServerConfig();
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
  const { user, isAuthenticated, logout, login, register } = useAuth();
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reenabling, setReenabling] = useState(false);

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
      : configured
        ? { label: "Sign in to sync across devices", tone: "muted" as const }
        : {
            label: "Local-only mode — prices are fetched on this device",
            tone: "muted" as const,
          };

  const handleSyncNow = useCallback(async () => {
    if (syncing || !getSyncSetup()) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await getSyncSetup()?.syncNow();
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      setNow(Date.now());
    } catch (e) {
      console.error("[Settings] syncNow failed", e);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const handleSignIn = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLoginModal(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, p] = await Promise.all([getSettings(), getWatchlist()]);
        if (!cancelled) {
          setSettings(s);
          setProducts(p);
        }
      } catch (e) {
        console.error("[Settings] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
      void maybeRefreshFxRates();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const current = await getSettings();
      const updated = { ...current, [key]: value };
      setSettings(updated);
      try {
        await saveSettings(updated);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setSettings(current);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Failed to save", "Could not save setting. Please try again.");
        return;
      }
      if (key === "checkInterval") {
        void syncBackgroundTasks();
      }
    },
    [],
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
      if (reenabling) return;
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setReenabling(true);
      try {
        const nowIso = new Date().toISOString();
        const tasks = products
          .filter((p) => p.listings?.some((l) => l.distributorId === distributorId))
          .map((product) => {
            const updatedListings: DistributorListing[] = product.listings.map((l) =>
              l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
            );
            return updateProductListings(product.id, updatedListings);
          });
        await Promise.all(tasks);
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            listings: p.listings?.map((l) =>
              l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
            ),
          })),
        );
      } catch (e) {
        console.error("[Settings] handleReenableDistributor failed", e);
        showAlert("Failed", "Could not re-enable distributor. Please try again.");
      } finally {
        setReenabling(false);
      }
    },
    [products, reenabling],
  );

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

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

        <ConnectionSection />

        {configured ? (
          <>
            <AccountSection
              isAuthenticated={isAuthenticated}
              user={user}
              syncMeta={syncMeta}
              syncing={syncing}
              onSyncNow={handleSyncNow}
              onSignOut={logout}
              onSignIn={handleSignIn}
              syncStatus={syncStatus}
            />

            <DeviceManagementSection
              user={user}
              isAuthenticated={isAuthenticated}
              colors={colors}
            />
          </>
        ) : (
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              marginHorizontal: 16,
              marginTop: 8,
              lineHeight: 18,
            }}
          >
            Local-only mode — prices are fetched directly from distributors on
            this device. Sign-in and cross-device sync are unavailable.
          </Text>
        )}

        <DataSection />

        <NotificationsSection
          settings={settings}
          updateSetting={updateSetting}
          onTestNotification={handleTestNotification}
          setSettings={setSettings}
          webNotificationHint={webNotificationHint}
          setWebNotificationHint={setWebNotificationHint}
        />

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
          <PillPicker
            icon="dollarsign.circle.fill"
            label="Display Currency"
            options={currencies}
            value={settings.displayCurrency}
            onSelect={(c) => updateSetting("displayCurrency", c)}
          />
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
          <PillPicker
            icon="globe"
            label="Shipping Region"
            options={regions}
            value={settings.shippingRegion ?? "Asia-Pacific"}
            onSelect={(r) => updateSetting("shippingRegion", r)}
          />
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
          <RadioPicker
            icon="clock.fill"
            label="Check Interval"
            options={intervals}
            value={settings.checkInterval}
            onSelect={(v) =>
              updateSetting(
                "checkInterval",
                v as AppSettings["checkInterval"],
              )
            }
          />
        </View>

        <ScraperStatusSection
          products={products}
          onReenableDistributor={handleReenableDistributor}
        />

        <LlmSettingsSection settings={settings} onUpdate={updateSetting} />

        <SectionHeader title="Collaborative Watchlist" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            padding: 16,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>Share watchlist</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Create a read-only public link to your watchlist. Anyone with the link can view it.
          </Text>
          <ShareWatchlistButton />
          {isAuthenticated && <SharedLinksList />}
        </View>

        <AboutSection />
      </ScrollView>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={login}
        onRegister={register}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";

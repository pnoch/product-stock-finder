import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

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
    getSettings()
      .then(setSettings)
      .catch((e) => console.error("[Settings] getSettings failed", e));
    getWatchlist()
      .then(setProducts)
      .catch((e) => console.error("[Settings] getWatchlist failed", e));
    void maybeRefreshFxRates();
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
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw new Error("Failed to save setting");
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
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const nowIso = new Date().toISOString();
      for (const product of products) {
        if (!product.listings) continue;
        const updatedListings: DistributorListing[] = product.listings.map(
          (l) =>
            l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
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
            l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
          ),
        })),
      );
    },
    [products],
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
  const digestFrequencies = [
    { value: "off", label: "Off" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];

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
          <RadioPicker
            icon="envelope.fill"
            label="Price Digest"
            options={digestFrequencies}
            value={settings.digestFrequency ?? "off"}
            onSelect={(v) =>
              updateSetting(
                "digestFrequency",
                v as AppSettings["digestFrequency"],
              )
            }
          />
        </View>

        <ScraperStatusSection
          products={products}
          onReenableDistributor={handleReenableDistributor}
        />

        <LlmSettingsSection settings={settings} onUpdate={updateSetting} />

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

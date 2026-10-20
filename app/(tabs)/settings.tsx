import { log } from "@shared/log";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Platform, ActivityIndicator, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/lib/settings-provider";
import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useServerConfig } from "@/hooks/use-server-config";
import { track } from "@/lib/telemetry";
import { getWatchlist } from "@/lib/storage";
import { maybeRefreshFxRates } from "@/lib/fx";
import { AppSettings, Product } from "@/lib/types";
import { showAlert } from "@/lib/alert";
import { sendTestNotification } from "@/lib/notifications";
import {
  checkPriceDropsNow,
  registerPriceCheckTask,
  syncBackgroundTasks,
} from "@/lib/background-price-check";
import { useMonitoringHealth } from "@/hooks/use-monitoring-health";

import { ConnectionSection } from "@/components/settings/connection-section";
import { AccountSection } from "@/components/settings/account-section";
import { DeviceManagementSection } from "@/components/settings/device-management-section";
import { DataSection } from "@/components/settings/data-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ScraperStatusSection } from "@/components/settings/scraper-status-section";
import { LlmSettingsSection } from "@/components/settings/llm-settings-section";
import { AboutSection } from "@/components/settings/about-section";
import { SiteSessionsSection } from "@/components/settings/site-sessions-section";
import { BackgroundRefreshSection } from "@/components/settings/background-refresh-section";
import { useSettingsSync } from "@/hooks/use-settings-sync";
import {
  SharedLinksList,
  JoinedSharedList,
  ShareWatchlistButton,
} from "@/components/settings/shared-links";
import { LoginModal } from "@/components/settings/login-modal";
import { PillPicker } from "@/components/settings/pill-picker";
import { RadioPicker } from "@/components/settings/radio-picker";
import { SectionHeader } from "@/components/settings/section-header";
import { SettingRow } from "@/components/settings/setting-row";
import { CountryPicker } from "@/components/ui/country-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCountry } from "@shared/countries";
import { CURRENCIES } from "@shared/currency";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { configured } = useServerConfig();
  const {
    settings,
    loading: settingsLoading,
    updateSetting: saveSetting,
    refresh: refreshSettings,
  } = useSettings();
  const [webNotificationHint, setWebNotificationHint] = useState<string | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const { user, isAuthenticated, logout, login, register } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const loading = settingsLoading || watchlistLoading;
  const [reenabling, setReenabling] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { health: monitoring, refresh: refreshMonitoring } = useMonitoringHealth();
  const { syncMeta, syncing, syncStatus, handleSyncNow } = useSettingsSync(
    isAuthenticated,
    configured,
  );

  const openPaywall = useCallback(() => {
    track("paywall_shown");
    setPaywallVisible(true);
  }, []);

  const handleSignIn = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLoginModal(true);
  }, []);

  const reloadData = useCallback(async () => {
    try {
      const [, p] = await Promise.all([refreshSettings(), getWatchlist()]);
      setProducts(p);
    } catch (e) {
      log.error("[Settings] reload failed", e);
    }
  }, [refreshSettings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getWatchlist();
        if (!cancelled) setProducts(p);
      } catch (e) {
        log.error("[Settings] load failed", e);
      } finally {
        if (!cancelled) setWatchlistLoading(false);
      }
      void maybeRefreshFxRates().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      try {
        await saveSetting(key, value);
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Failed to save", "Could not save setting. Please try again.");
        return;
      }
      if (key === "checkInterval") {
        void syncBackgroundTasks();
      }
    },
    [saveSetting],
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
        // Only clear the circuit breaker so the next price check attempts the
        // fetch again. Do NOT stamp lastChecked here: that field means "last
        // successful check" (refresh-listing.ts writes it only on a successful
        // parse), so stamping it made a Failed distributor show "OK / Last
        // checked: today" with no prices actually fetched.
        const { clearDistributorBreaker } = await import("@/lib/scrapers/breaker-clear");
        await clearDistributorBreaker(distributorId);
      } catch (e) {
        log.error("[Settings] handleReenableDistributor failed", e);
        showAlert("Failed", "Could not re-enable distributor. Please try again.");
      } finally {
        setReenabling(false);
      }
    },
    [reenabling],
  );

  const handleReenableMonitoring = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await registerPriceCheckTask();
      // A stale task is already registered; re-registering won't refresh the
      // last-run timestamp, so run a foreground check to clear `stale`.
      if (monitoring.status === "stale") {
        await checkPriceDropsNow();
      }
      await refreshMonitoring();
    } catch (e) {
      log.error("[Settings] handleReenableMonitoring failed", e);
      showAlert("Failed", "Could not re-enable background monitoring. Please try again.");
    }
  }, [refreshMonitoring, monitoring.status]);

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
          key={settings.alertWebhookUrl ?? ""}
          settings={settings}
          updateSetting={updateSetting}
          onTestNotification={handleTestNotification}
          webNotificationHint={webNotificationHint}
          setWebNotificationHint={setWebNotificationHint}
        />

        <SectionHeader title="Background Refresh" />
        <BackgroundRefreshSection
          settings={settings}
          updateSetting={updateSetting}
          isPro={isPro}
          openPaywall={openPaywall}
          monitoring={monitoring}
          onReenableMonitoring={handleReenableMonitoring}
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
            options={CURRENCIES}
            value={settings.displayCurrency}
            onSelect={(c) => updateSetting("displayCurrency", c)}
          />
        </View>

        <SectionHeader title="Ship to" />
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
          <Pressable
            onPress={() => setCountryPickerVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
            accessibilityLabel="Choose shipping country"
            accessibilityRole="button"
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
              <IconSymbol name="location.fill" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}
              >
                Ship to
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
                {getCountry(settings.shipToCountry ?? "")?.name ?? "Choose country"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
          <SettingRow
            icon="dollarsign.circle.fill"
            label="I'm tax-exempt (VAT/EORI)"
            description="Omit tax and duty from landed-cost totals."
            right={
              <Switch
                value={!!settings.taxExempt}
                onValueChange={(v) => void updateSetting("taxExempt", v)}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={settings.taxExempt ? colors.primary : colors.muted}
                accessibilityLabel="I'm tax-exempt"
                accessibilityRole="switch"
              />
            }
          />
          <SettingRow
            icon="cart.fill"
            label="Include import estimate"
            description="Add the destination duty/VAT estimate to the displayed total."
            right={
              <Switch
                value={!!settings.includeImportEstimate}
                onValueChange={(v) =>
                  void updateSetting("includeImportEstimate", v)
                }
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={
                  settings.includeImportEstimate ? colors.primary : colors.muted
                }
                accessibilityLabel="Include import estimate"
                accessibilityRole="switch"
              />
            }
          />
        </View>

        <CountryPicker
          visible={countryPickerVisible}
          value={settings.shipToCountry}
          onSelect={(code) => {
            void updateSetting("shipToCountry", code);
            setCountryPickerVisible(false);
          }}
          onClose={() => setCountryPickerVisible(false)}
        />

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

        <LlmSettingsSection
          key={`${settings.llmApiKey ?? ""}|${settings.llmModel ?? ""}|${settings.llmOllamaUrl ?? ""}`}
          settings={settings}
          onUpdate={updateSetting}
        />

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
            Create a read-only link to your watchlist. Anyone with the link can view it unless you
            make it members-only.
          </Text>
          <ShareWatchlistButton isAuthenticated={isAuthenticated} onSignIn={handleSignIn} />
          {isAuthenticated && <SharedLinksList />}
          {isAuthenticated && <JoinedSharedList />}
        </View>

        <SectionHeader title="Pro" />
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
          <Pressable
            onPress={openPaywall}
            accessibilityLabel="Upgrade to Pro"
            accessibilityRole="button"
          >
            <SettingRow
              icon="crown.fill"
              label="Upgrade to Pro"
              description="Unlock unlimited tracking, background monitoring, and sync."
              right={
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.primary}
                />
              }
            />
          </Pressable>
        </View>

        <AboutSection onDataCleared={reloadData} />
        <SiteSessionsSection />
      </ScrollView>

      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

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

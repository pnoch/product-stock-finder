import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, Linking, ActivityIndicator, Platform } from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import { showAlert } from "@/lib/alert";
import { clearAllData } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function AboutSection() {
  const colors = useColors();
  const { isAuthenticated, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setDeferredPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setDeferredPrompt(null);
    } catch (e) {
      console.warn("[AboutSection] install prompt failed", e);
    }
  };

  const handleRateApp = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const androidUrl = "market://details?id=com.app.stock_tracker_pro";
    const iosUrl = "itms-apps://itunes.apple.com/app/idcom.app.stock_tracker_pro";
    const webFallback = "https://play.google.com/store/apps/details?id=com.app.stock_tracker_pro";
    try {
      if (Platform.OS === "ios") {
        const canOpen = await Linking.canOpenURL(iosUrl);
        if (canOpen) {
          await Linking.openURL(iosUrl);
          return;
        }
        await Linking.openURL(webFallback);
        return;
      }
      if (Platform.OS === "android") {
        const canOpen = await Linking.canOpenURL(androidUrl);
        if (canOpen) {
          await Linking.openURL(androidUrl);
          return;
        }
        await Linking.openURL(webFallback);
        return;
      }
      await Linking.openURL(webFallback);
    } catch (e) {
      console.warn("[AboutSection] rate app failed", e);
      try {
        await Linking.openURL(webFallback);
      } catch {}
    }
  };

  const handleDeleteMyData = () => {
    showAlert(
      "Delete My Data?",
      "This will permanently delete all local data (watchlist, alerts, reminders, settings) and, if signed in, delete your account on the server. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              if (isAuthenticated) {
                const baseUrl = getApiBaseUrl();
                if (baseUrl) {
                  try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (Platform.OS !== "web") {
                      const token = await Auth.getSessionToken();
                      if (token) headers.Authorization = `Bearer ${token}`;
                    }
                    await fetch(`${baseUrl}/api/auth/delete-account`, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({ confirm: "DELETE" }),
                      credentials: "include",
                    });
                  } catch (e) {
                    console.warn("[AboutSection] server delete failed", e);
                  }
                }
                try {
                  await logout();
                } catch {}
              }
              await clearAllData();
              showAlert("Data Deleted", "All local data has been cleared.");
            } catch (e) {
              showAlert("Delete Failed", e instanceof Error ? e.message : String(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
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
        <TouchableOpacity activeOpacity={0.7}
          onPress={() =>
            Linking.openURL("https://productstockfinder.app/privacy")
          }
          accessibilityLabel="Open privacy policy"
          accessibilityRole="link"
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
        <TouchableOpacity activeOpacity={0.7}
          onPress={handleRateApp}
          accessibilityLabel="Rate the app"
          accessibilityRole="link"
        >
          <SettingRow
            icon="star.fill"
            label="Rate the App"
            description="Love the app? Leave a review"
            right={
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.muted}
              />
            }
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          onPress={handleDeleteMyData}
          disabled={deleting}
          accessibilityLabel="Delete my data"
          accessibilityRole="button"
        >
          <SettingRow
            icon="trash.fill"
            label="Delete My Data"
            description="Clear local data and delete server account if signed in"
            right={
              deleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.muted}
                />
              )
            }
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          onPress={() =>
            Linking.openURL("mailto:support@productstockfinder.app")
          }
          accessibilityLabel="Contact support"
          accessibilityRole="link"
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
        {deferredPrompt && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleInstall}
            accessibilityLabel="Install app"
            accessibilityRole="button"
          >
            <SettingRow
              icon="arrow.down.circle.fill"
              label="Install app"
              description="Add to home screen for offline access"
              right={
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.primary}
                />
              }
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ alignItems: "center", marginTop: 32 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Product Stock Finder · v{Constants.expoConfig?.version ?? "dev"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
          Track smarter. Buy better.
        </Text>
      </View>
    </>
  );
}

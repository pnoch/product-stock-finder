import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getOAuthUrl } from "@/constants/oauth";
import type { SyncMeta } from "@/lib/types";
import type { User } from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";
import { clearAllData } from "@/lib/storage";
import { showAlert } from "@/lib/alert";

export function AccountSection({
  isAuthenticated,
  user,
  syncMeta,
  syncing,
  onSyncNow,
  onSignOut,
  onSignIn,
  syncStatus,
}: {
  isAuthenticated: boolean;
  user: User | null | undefined;
  syncMeta: SyncMeta | null;
  syncing: boolean;
  onSyncNow: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
  syncStatus: { label: string; tone: "muted" | "error" | "success" };
}) {
  const colors = useColors();
  const router = useRouter();
  const { changePassword, deleteAccount } = useAuth({ autoFetch: false });

  // ─── Change Password state ─────────────────────────────────────────────
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // ─── Delete Account state ──────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteTypedEmail, setDeleteTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const emailVerified = (user as any)?.emailVerified ?? false;
  const showVerificationBadge = Boolean(isAuthenticated && user?.email);

  const handleChangePassword = async () => {
    setChangeError(null);
    if (!currentPw || !newPw || !confirmPw) {
      setChangeError("All fields are required");
      return;
    }
    if (newPw.length < 6) {
      setChangeError("New password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setChangeError("New passwords do not match");
      return;
    }
    setChanging(true);
    try {
      await changePassword(currentPw, newPw);
      setShowChangePw(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setChangeError(null);
      showAlert("Success", "Password changed successfully");
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : String(e));
    } finally {
      setChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      showAlert("Confirm required", 'Please type DELETE to confirm');
      return;
    }
    if ((deleteTypedEmail.trim().toLowerCase()) !== (user?.email ?? "").toLowerCase()) {
      showAlert("Email mismatch", "Typed email does not match your account email");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount("DELETE");
      await clearAllData();
      await onSignOut();
      setShowDelete(false);
      setDeleteStep(1);
      setDeleteConfirmText("");
      setDeleteTypedEmail("");
      router.replace("/");
    } catch (e) {
      showAlert("Delete failed", e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      const url = await getOAuthUrl(provider);
      if (!url) {
        showAlert("OAuth not configured", "Server not configured for social login.");
        return;
      }
      if (Platform.OS === "web") {
        window.location.href = url;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, "productstockfinder:/oauth/callback");
      if (result.type === "success" && result.url) {
        await Linking.openURL(result.url);
      }
    } catch (e) {
      showAlert("OAuth failed", e instanceof Error ? e.message : String(e));
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <>
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
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text
                  style={{
                    color: colors.success,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Signed in
                </Text>
                {showVerificationBadge && (
                  <Text
                    style={{
                      color: emailVerified ? colors.success : colors.warning,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                    accessibilityLabel={emailVerified ? "Verified" : "Check your email"}
                  >
                    {emailVerified ? "Verified ✓" : "Check your email"}
                  </Text>
                )}
              </View>
            }
          />
        ) : (
          <SettingRow
            icon="person.crop.circle.badge.plus"
            label="Sign in to sync"
            description="Sync your watchlist and alerts across devices"
            right={
              <TouchableOpacity activeOpacity={0.85}
                onPress={onSignIn}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: colors.primary + "22",
                }}
                accessibilityLabel="Sign in"
                accessibilityRole="button"
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
        {!isAuthenticated && (
          <>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ padding: 12, gap: 8 }}>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => handleOAuth("google")}
                disabled={!!oauthLoading}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: oauthLoading ? 0.6 : 1,
                }}
                accessibilityLabel="Continue with Google"
                accessibilityRole="button"
              >
                {oauthLoading === "google" ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <IconSymbol name="globe" size={16} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => handleOAuth("apple")}
                disabled={!!oauthLoading}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: colors.foreground,
                  borderRadius: 12,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: colors.foreground,
                  opacity: oauthLoading ? 0.6 : 1,
                }}
                accessibilityLabel="Continue with Apple"
                accessibilityRole="button"
              >
                {oauthLoading === "apple" ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <>
                    <IconSymbol name="globe" size={16} color={colors.background} />
                    <Text style={{ color: colors.background, fontSize: 13, fontWeight: "600" }}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
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
                <TouchableOpacity activeOpacity={0.85}
                  onPress={onSyncNow}
                  disabled={syncing}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                  accessibilityLabel="Sync now"
                  accessibilityRole="button"
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
                <TouchableOpacity activeOpacity={0.7}
                  onPress={onSignOut}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.error + "22",
                  }}
                  accessibilityLabel="Sign out"
                  accessibilityRole="button"
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
        {isAuthenticated && (
          <>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => setShowChangePw(true)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
                accessibilityLabel="Change Password"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Change Password</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => { setShowDelete(true); setDeleteStep(1); setDeleteConfirmText(""); setDeleteTypedEmail(""); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.error + "14",
                  borderWidth: 1,
                  borderColor: colors.error + "40",
                  alignItems: "center",
                }}
                accessibilityLabel="Delete Account & Data"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Delete Account & Data</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ─── Change Password Sheet ─────────────────────────────────────── */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={() => setShowChangePw(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Change Password</Text>
              <TextInput
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="Current password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
                accessibilityLabel="Current password"
              />
              <TextInput
                value={newPw}
                onChangeText={setNewPw}
                placeholder="New password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
                accessibilityLabel="New password"
              />
              <TextInput
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Confirm new password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
                accessibilityLabel="Confirm new password"
              />
              {changeError && <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>{changeError}</Text>}
              <TouchableOpacity activeOpacity={0.85} onPress={handleChangePassword} disabled={changing} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12, opacity: changing ? 0.5 : 1 }} accessibilityLabel="Submit change password" accessibilityRole="button">
                {changing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Update password</Text>}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => { setShowChangePw(false); setChangeError(null); }} style={{ alignItems: "center" }} accessibilityLabel="Cancel change password" accessibilityRole="button">
                <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Delete Account Sheet ──────────────────────────────────────── */}
      <Modal visible={showDelete} transparent animationType="slide" onRequestClose={() => setShowDelete(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.error, marginBottom: 8 }}>Delete Account & Data</Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>This will permanently delete your account and all associated data (GDPR Art.17). This cannot be undone.</Text>
              {deleteStep === 1 ? (
                <>
                  <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Type DELETE to confirm:</Text>
                  <TextInput
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    placeholder="DELETE"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                    accessibilityLabel="Type DELETE to confirm"
                  />
                  <TouchableOpacity activeOpacity={0.85} onPress={() => { if (deleteConfirmText === "DELETE") setDeleteStep(2); else showAlert("Confirm", 'Please type DELETE'); }} style={{ backgroundColor: colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 }} accessibilityLabel="Continue to email confirmation" accessibilityRole="button">
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Continue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDelete(false)} style={{ alignItems: "center" }} accessibilityLabel="Cancel delete account" accessibilityRole="button">
                    <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Type your email to confirm ({user?.email}):</Text>
                  <TextInput
                    value={deleteTypedEmail}
                    onChangeText={setDeleteTypedEmail}
                    placeholder={user?.email ?? "email"}
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                    accessibilityLabel="Type email to confirm deletion"
                  />
                  <TouchableOpacity activeOpacity={0.85} onPress={handleDeleteAccount} disabled={deleting} style={{ backgroundColor: colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12, opacity: deleting ? 0.5 : 1 }} accessibilityLabel="Confirm delete account" accessibilityRole="button">
                    {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Delete Account & Data</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setDeleteStep(1)} style={{ alignItems: "center", marginBottom: 12 }} accessibilityLabel="Back" accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontSize: 14 }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDelete(false)} style={{ alignItems: "center" }} accessibilityLabel="Cancel delete account step 2" accessibilityRole="button">
                    <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

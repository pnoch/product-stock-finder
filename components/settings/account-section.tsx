import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { isServerConfigured } from "@/constants/oauth";
import type { SyncMeta } from "@/lib/types";
import type { User } from "@/lib/_core/auth";
import { useAccountSection } from "@/hooks/use-account-section";
import { showAlert } from "@/lib/alert";
import { AccountOAuthButtons } from "./account-oauth-buttons";
import { ChangePasswordSheet } from "./change-password-sheet";
import { DeleteAccountSheet } from "./delete-account-sheet";

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
  const configured = isServerConfigured();
  const {
    showChangePw,
    setShowChangePw,
    currentPw,
    setCurrentPw,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    changeError,
    setChangeError,
    changing,
    handleChangePassword,
    showDelete,
    setShowDelete,
    deleteConfirmText,
    setDeleteConfirmText,
    deleteTypedEmail,
    setDeleteTypedEmail,
    deleting,
    deleteStep,
    setDeleteStep,
    oauthLoading,
    resending,
    handleResendVerification,
    handleDeleteAccount,
    handleOAuth,
    openDelete,
  } = useAccountSection({ user, onSignOut });

  const emailVerified = user?.emailVerified ?? false;
  const showVerificationBadge = Boolean(isAuthenticated && user?.email);
  const needsVerification = Boolean(isAuthenticated && user?.email && !emailVerified);

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
                    {emailVerified ? "Verified" : "Check your email"}
                  </Text>
                )}
              </View>
            }
          />
        ) : configured ? (
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
        ) : (
          <SettingRow
            icon="iphone"
            label="Local mode"
            description="No server configured — your data stays on this device"
            right={<Text style={{ color: colors.muted, fontSize: 12 }}>On-device</Text>}
          />
        )}
        {needsVerification && (
          <>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.warning + "14",
                borderWidth: 1,
                borderColor: colors.warning + "30",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginHorizontal: 12,
                marginVertical: 8,
              }}
              accessibilityLabel="Email verification banner"
            >
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />
              <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontWeight: "500" }}>
                Verify your email — check your inbox
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleResendVerification}
                disabled={resending}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: colors.warning,
                  opacity: resending ? 0.6 : 1,
                }}
                accessibilityLabel="Resend verification email"
                accessibilityRole="button"
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Resend</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        {!isAuthenticated && (
          <>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <AccountOAuthButtons
              colors={colors}
              oauthLoading={oauthLoading}
              onOAuth={(provider) => void handleOAuth(provider)}
            />
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
                  onPress={() =>
                    showAlert(
                      "Sign out?",
                      "Signing out removes this device's local watchlist, alerts, reminders, and settings. Anything already synced stays on your account.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Sign out",
                          style: "destructive",
                          onPress: onSignOut,
                        },
                      ],
                    )
                  }
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
                onPress={openDelete}
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

      <ChangePasswordSheet
        visible={showChangePw}
        onClose={() => {
          setShowChangePw(false);
          setChangeError(null);
        }}
        colors={colors}
        currentPw={currentPw}
        onCurrentPw={setCurrentPw}
        newPw={newPw}
        onNewPw={setNewPw}
        confirmPw={confirmPw}
        onConfirmPw={setConfirmPw}
        changeError={changeError}
        changing={changing}
        onSubmit={() => void handleChangePassword()}
      />

      <DeleteAccountSheet
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        colors={colors}
        user={user}
        deleteStep={deleteStep}
        onDeleteStep={setDeleteStep}
        deleteConfirmText={deleteConfirmText}
        onDeleteConfirmText={setDeleteConfirmText}
        deleteTypedEmail={deleteTypedEmail}
        onDeleteTypedEmail={setDeleteTypedEmail}
        deleting={deleting}
        onDelete={() => void handleDeleteAccount()}
      />
    </>
  );
}

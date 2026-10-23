import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useLoginModal } from "@/hooks/use-login-modal";
import { ForgotPasswordView } from "./forgot-password-view";
import { LoginOAuthButtons } from "./login-oauth-buttons";

export function LoginModal({
  visible,
  onClose,
  onLogin,
  onRegister,
  onForgotPassword,
}: {
  visible: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
}) {
  const colors = useColors();
  const {
    mode,
    focusedField,
    setFocusedField,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    loading,
    error,
    forgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotError,
    forgotSent,
    oauthLoading,
    oauthProviders,
    handleSubmit,
    switchMode,
    handleForgotSubmit,
    handleOAuth,
    openForgot,
    closeForgot,
  } = useLoginModal({ visible, onClose, onLogin, onRegister, onForgotPassword });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
            accessibilityViewIsModal
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {forgotOpen ? (
              <ForgotPasswordView
                colors={colors}
                email={email}
                forgotEmail={forgotEmail}
                onForgotEmail={setForgotEmail}
                focusedField={focusedField}
                onFocus={() => setFocusedField("forgotEmail")}
                onBlur={() => setFocusedField(null)}
                forgotError={forgotError}
                forgotLoading={forgotLoading}
                forgotSent={forgotSent}
                onSubmit={() => void handleForgotSubmit()}
                onClose={closeForgot}
              />
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: colors.foreground,
                    marginBottom: 4,
                  }}
                >
                  {mode === "login" ? "Sign in" : "Create account"}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.muted,
                    marginBottom: 20,
                  }}
                >
                  {mode === "login"
                    ? "Sign in to sync your data across devices"
                    : "Create an account to get started"}
                </Text>

                {mode === "register" && (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Name (optional)"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Name"
                    autoCapitalize="words"
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.foreground,
                      borderWidth: 1,
                      borderColor: focusedField === "name" ? colors.primary : colors.border,
                      marginBottom: 12,
                    }}
                  />
                )}

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: colors.foreground,
                    borderWidth: 1,
                    borderColor: focusedField === "email" ? colors.primary : colors.border,
                    marginBottom: 12,
                  }}
                />

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Password"
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: colors.foreground,
                    borderWidth: 1,
                    borderColor: focusedField === "password" ? colors.primary : colors.border,
                    marginBottom: 8,
                  }}
                />

                {mode === "login" && (
                  <TouchableOpacity activeOpacity={0.7} onPress={openForgot} style={{ alignSelf: "flex-end", marginBottom: 16 }} accessibilityLabel="Forgot password" accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontSize: 13 }}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {mode !== "login" && <View style={{ height: 8 }} />}

                {error && (
                  <Text
                    accessibilityRole="alert"
                    style={{
                      color: colors.error,
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    {error}
                  </Text>
                )}

                <TouchableOpacity activeOpacity={0.85}
                  onPress={handleSubmit}
                  disabled={loading}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginBottom: 12,
                    opacity: loading ? 0.5 : 1,
                  }}
                  accessibilityLabel={mode === "login" ? "Sign in" : "Create account"}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {mode === "login" ? "Sign in" : "Create account"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} onPress={switchMode} style={{ alignItems: "center" }} accessibilityLabel={mode === "login" ? "Switch to sign up" : "Switch to sign in"} accessibilityRole="button">
                  <Text style={{ color: colors.primary, fontSize: 14 }}>
                    {mode === "login"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </Text>
                </TouchableOpacity>

                <LoginOAuthButtons
                  colors={colors}
                  oauthProviders={oauthProviders}
                  oauthLoading={oauthLoading}
                  onOAuth={(provider) => void handleOAuth(provider)}
                />

                <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center", marginTop: 4 }} accessibilityLabel="Dismiss" accessibilityRole="button" accessibilityHint="Dismisses the login dialog">
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

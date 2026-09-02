import { useState } from "react";
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
import { getApiBaseUrl } from "@/constants/oauth";

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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name || undefined);
      }
      setEmail("");
      setPassword("");
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  const handleForgotSubmit = async () => {
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail) {
      setForgotError("Email is required");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      if (onForgotPassword) {
        await onForgotPassword(targetEmail);
      } else {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/forgot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to send reset email");
        }
      }
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed");
    } finally {
      setForgotLoading(false);
    }
  };

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
              <>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: colors.foreground,
                    marginBottom: 4,
                  }}
                >
                  Reset password
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.muted,
                    marginBottom: 20,
                  }}
                >
                  Enter your email and we will send a reset link
                </Text>

                {forgotSent ? (
                  <>
                    <View
                      style={{
                        backgroundColor: colors.background,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 14, textAlign: "center" }}>
                        If an account exists for {forgotEmail.trim() || email.trim()}, a reset email has been sent. Check your inbox.
                      </Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.85}
                      onPress={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); setForgotError(null); }}
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                      accessibilityLabel="Back to sign in"
                      accessibilityRole="button"
                    >
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Back to sign in</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TextInput
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder={email || "Email"}
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      onFocus={() => setFocusedField("forgotEmail")}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        backgroundColor: colors.background,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        color: colors.foreground,
                        borderWidth: 1,
                        borderColor: focusedField === "forgotEmail" ? colors.primary : colors.border,
                        marginBottom: 12,
                      }}
                    />
                    {forgotError && (
                      <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>{forgotError}</Text>
                    )}
                    <TouchableOpacity activeOpacity={0.85}
                      onPress={handleForgotSubmit}
                      disabled={forgotLoading}
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: "center",
                        marginBottom: 12,
                        opacity: forgotLoading ? 0.5 : 1,
                      }}
                      accessibilityLabel="Send reset email"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: forgotLoading }}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Send reset email</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => { setForgotOpen(false); setForgotError(null); setForgotSent(false); }} style={{ alignItems: "center" }} accessibilityLabel="Back to sign in" accessibilityRole="button">
                      <Text style={{ color: colors.primary, fontSize: 14 }}>Back to sign in</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
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
                  <TouchableOpacity activeOpacity={0.7} onPress={() => { setForgotOpen(true); setForgotEmail(email); setForgotError(null); setForgotSent(false); }} style={{ alignSelf: "flex-end", marginBottom: 16 }} accessibilityLabel="Forgot password" accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontSize: 13 }}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {mode !== "login" && <View style={{ height: 8 }} />}

                {error && (
                  <Text
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

                <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center", marginTop: 16 }} accessibilityLabel="Dismiss" accessibilityRole="button" accessibilityHint="Dismisses the login dialog">
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

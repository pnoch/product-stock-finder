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

export function LoginModal({
  visible,
  onClose,
  onLogin,
  onRegister,
}: {
  visible: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
}) {
  const colors = useColors();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Modal visible={visible} transparent animationType="slide">
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
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
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
                marginBottom: 16,
              }}
            />

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

            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center", marginTop: 16 }} accessibilityLabel="Cancel" accessibilityRole="button">
              <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

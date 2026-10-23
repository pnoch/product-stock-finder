import { Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function WebhookSettings({
  colors,
  isAuthenticated,
  webhookUrl,
  onWebhookUrl,
  onCommit,
  webhookAlerts,
  onWebhookAlerts,
  testing,
  onTest,
  hint,
  hintOk,
}: {
  colors: Colors;
  isAuthenticated: boolean;
  webhookUrl: string;
  onWebhookUrl: (value: string) => void;
  onCommit: () => void;
  webhookAlerts: boolean;
  onWebhookAlerts: (value: boolean) => void;
  testing: boolean;
  onTest: () => void;
  hint: string | null;
  hintOk: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 14,
          fontWeight: "600",
          marginBottom: 8,
        }}
      >
        Webhook Alerts
      </Text>
      <TextInput
        value={webhookUrl}
        onChangeText={onWebhookUrl}
        onBlur={onCommit}
        placeholder="https://discord.com/api/webhooks/…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={isAuthenticated}
        accessibilityLabel="Webhook URL"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.foreground,
          backgroundColor: colors.background,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        <Switch
          value={webhookAlerts}
          disabled={!isAuthenticated}
          onValueChange={onWebhookAlerts}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={webhookAlerts ? colors.primary : colors.muted}
          accessibilityLabel="Enable webhook alerts"
          accessibilityRole="switch"
        />
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!isAuthenticated || testing}
          onPress={onTest}
          accessibilityLabel="Send test webhook"
          accessibilityRole="button"
        >
          <Text
            style={{
              color: isAuthenticated ? colors.primary : colors.muted,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {testing ? "Sending…" : "Send test"}
          </Text>
        </TouchableOpacity>
      </View>
      {hint && (
        <Text
          style={{
            color: hintOk ? colors.success : colors.error,
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {hint}
        </Text>
      )}
      {!isAuthenticated && (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
          Sign in to use webhook alerts.
        </Text>
      )}
    </View>
  );
}

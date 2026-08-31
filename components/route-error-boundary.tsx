import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";

function ThemedFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.error + "22",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 32 }}>⚠️</Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>
        We couldn&apos;t load this screen
      </Text>
      <Text
        style={{
          marginTop: 8,
          color: colors.muted,
          textAlign: "center",
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        Something unexpected happened. Your data is safe — try again or go back.
      </Text>
      {message ? (
        <Text
          style={{
            marginTop: 12,
            color: colors.muted,
            textAlign: "center",
            fontSize: 12,
            opacity: 0.8,
          }}
          numberOfLines={2}
        >
          {message}
        </Text>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onRetry}
        style={{
          marginTop: 20,
          backgroundColor: colors.primary,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
        accessibilityLabel="Try Again"
        accessibilityRole="button"
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.back()}
        style={{
          marginTop: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: colors.surface,
        }}
        accessibilityLabel="Go Back"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.primary, fontWeight: "600" }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message.slice(0, 160) };
  }

  componentDidCatch(error: Error) {
    console.error("[RouteErrorBoundary]", error);
    void AsyncStorage.setItem("last_error", error.message).catch(() => {});
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ThemedFallback
        message={this.state.message}
        onRetry={() => this.setState({ hasError: false, message: "" })}
      />
    );
  }
}

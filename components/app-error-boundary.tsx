import React from "react";
import { Text, View, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

function ThemedAppFallback({
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
        Something went wrong
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
        An unexpected error occurred. Your data is safe — please try again.
      </Text>
      {message ? (
        <Text
          style={{
            marginTop: 10,
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
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRetry();
        }}
        android_ripple={{ color: "#ffffff33" }}
        style={({ pressed }) => ({
          marginTop: 20,
          backgroundColor: colors.primary,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
          opacity: pressed ? 0.85 : 1,
          overflow: "hidden",
        })}
        accessibilityLabel="Try Again"
        accessibilityRole="button"
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.replace("/(tabs)");
        }}
        android_ripple={{ color: colors.primary + "22" }}
        style={({ pressed }) => ({
          marginTop: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
          overflow: "hidden",
        })}
        accessibilityLabel="Go Home"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.primary, fontWeight: "600" }}>Go Home</Text>
      </Pressable>
    </View>
  );
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    const raw = String((error as Error)?.message ?? "Unknown error");
    let safeMessage: string;
    try {
      const Segmenter = (Intl as unknown as { Segmenter?: unknown })?.Segmenter as
        | (new (locale: string | undefined, opts: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> })
        | undefined;
      if (Segmenter) {
        const seg = new Segmenter(undefined, { granularity: "grapheme" });
        safeMessage = [...seg.segment(raw)].slice(0, 120).map((s) => s.segment).join("");
      } else {
        safeMessage = Array.from(raw).slice(0, 120).join("");
      }
    } catch {
      safeMessage = raw.slice(0, 120);
    }
    return { hasError: true, message: safeMessage };
  }
  componentDidCatch(error: Error) {
    console.error(error);
    const truncated = String(error.message).slice(0, 500);
    void AsyncStorage.setItem("last_error", truncated).catch(() => {});
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ThemedAppFallback
        message={this.state.message}
        onRetry={() => this.setState({ hasError: false, message: "" })}
      />
    );
  }
}

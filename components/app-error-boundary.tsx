import React from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) { return { hasError: true, message: error.message.slice(0, 120) }; }
  componentDidCatch(error: Error) { console.error(error); void AsyncStorage.setItem("last_error", error.message).catch(() => {}); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F8FAFC" }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#EF444422", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0A0E1A" }}>Something went wrong</Text>
        <Text style={{ marginTop: 8, color: "#64748B", textAlign: "center", fontSize: 14, lineHeight: 20 }}>
          An unexpected error occurred. Your data is safe — please try again.
        </Text>
        {this.state.message ? (
          <Text style={{ marginTop: 10, color: "#94A3B8", textAlign: "center", fontSize: 12 }} numberOfLines={2}>
            {this.state.message}
          </Text>
        ) : null}
        <TouchableOpacity activeOpacity={0.7} onPress={() => this.setState({ hasError: false, message: "" })} style={{ marginTop: 20, backgroundColor: "#0F52BA", borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12 }} accessibilityLabel="Try Again" accessibilityRole="button"><Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text></TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.replace("/(tabs)")} style={{ marginTop: 10, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#fff" }} accessibilityLabel="Go Home" accessibilityRole="button"><Text style={{ color: "#0F52BA", fontWeight: "600" }}>Go Home</Text></TouchableOpacity>
      </View>
    );
  }
}

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Something went wrong</Text>
        <Text style={{ marginTop: 8, color: "#666" }}>{this.state.message}</Text>
        <TouchableOpacity onPress={() => this.setState({ hasError: false, message: "" })} style={{ marginTop: 16, backgroundColor: "#0F52BA", borderRadius: 8, padding: 10 }} accessibilityLabel="Try Again" accessibilityRole="button"><Text style={{ color: "#fff" }}>Try Again</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={{ marginTop: 8 }} accessibilityLabel="Go Home" accessibilityRole="button"><Text>Go Home</Text></TouchableOpacity>
      </View>
    );
  }
}

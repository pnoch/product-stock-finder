import { useState } from "react";
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { getWebViewHost } from "@/lib/scrapers/webview-host";
import { showAlert } from "@/lib/alert";

const RADIUS_OPTIONS = [10, 30, 64] as const;

export function FacebookSearchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Bangkok");
  const [radius, setRadius] = useState<number>(64);
  const [status, setStatus] = useState<"idle" | "checking" | "login_required" | "unavailable">("idle");

  const searchUrl = () => {
    const params = new URLSearchParams({ query: keyword.trim() });
    if (location.trim()) params.set("location", location.trim());
    params.set("radius", String(radius));
    return `https://www.facebook.com/marketplace/search/?${params.toString()}`;
  };

  const open = async () => {
    if (!keyword.trim()) return;
    if (Platform.OS === "web") {
      void Linking.openURL(searchUrl()).catch(() => showAlert("Couldn't open Facebook", "Please try again."));
      onClose();
      return;
    }
    setStatus("checking");
    try {
      const host = getWebViewHost();
      if (!host) throw new Error("unavailable");
      await host.load(searchUrl(), { timeoutMs: 25000 });
      // The WebView shows the page to the user; extraction of signed-in
      // results is a separate verified path (spec: session-dependent).
      setStatus("idle");
      onClose();
    } catch {
      setStatus("unavailable");
    }
  };

  const openExternally = () => {
    void Linking.openURL(searchUrl()).catch(() => showAlert("Couldn't open Facebook", "Please try again."));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}>Facebook Marketplace</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
          Search local listings on Facebook. Results open in the app browser —
          sign in to Facebook there to see listings. Copy a listing link and
          paste it into Add Product to track it.
        </Text>
        <TextInput
          accessibilityLabel="Search keyword"
          placeholder="What are you looking for?"
          placeholderTextColor={colors.muted}
          value={keyword}
          onChangeText={setKeyword}
          style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}
        />
        <TextInput
          accessibilityLabel="Search location"
          placeholder="Location (e.g. Bangkok)"
          placeholderTextColor={colors.muted}
          value={location}
          onChangeText={setLocation}
          style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}
        />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {RADIUS_OPTIONS.map((km) => (
            <TouchableOpacity
              key={km}
              accessibilityRole="button"
              accessibilityLabel={`Radius ${km} kilometres`}
              onPress={() => { setRadius(km); if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: radius === km ? colors.tint : colors.surface,
                borderWidth: 1, borderColor: radius === km ? colors.tint : colors.border,
              }}
            >
              <Text style={{ color: radius === km ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{km} km</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search Facebook Marketplace"
          disabled={!keyword.trim() || status === "checking"}
          onPress={() => void open()}
          style={{ backgroundColor: colors.tint, borderRadius: 12, padding: 14, alignItems: "center", opacity: !keyword.trim() || status === "checking" ? 0.5 : 1 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            {status === "checking" ? "Opening…" : "Search in app browser"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open in browser" onPress={openExternally} style={{ padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>Open in system browser instead</Text>
        </TouchableOpacity>
        {status === "unavailable" && (
          <Text style={{ color: colors.error, fontSize: 13, marginTop: 8 }}>
            The in-app browser is unavailable — use the system browser option.
          </Text>
        )}
      </View>
    </Modal>
  );
}
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { clearSiteData } from "@/lib/scrapers/session-assist";

export function SiteSessionsSection() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClear() {
    setBusy(true);
    try {
      await clearSiteData();
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
        Site sessions
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        Sign-ins and challenge passes for distributor sites are stored only on
        this device, never synced. Clearing signs you out of all of them.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear site sessions"
        disabled={busy}
        onPress={handleClear}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.error,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.error, fontWeight: "700", fontSize: 13 }}>
          {busy ? "Clearing…" : done ? "Cleared" : "Clear site sessions"}
        </Text>
      </Pressable>
    </View>
  );
}

import { useState } from "react";
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { SessionAssistModal } from "@/components/session-assist-modal";
import { useMarketplaceConnections } from "@/hooks/use-marketplace-connections";
import { buildFbSearchUrl, evaluateProbe } from "@/lib/marketplace/fb-search";
import { isMarketplaceUrlAllowed } from "@/lib/marketplace/connections";
import { getWebViewHost } from "@/lib/scrapers/webview-host";
import { showAlert } from "@/lib/alert";

const RADIUS_OPTIONS = [10, 30, 64] as const;
const PROBE_TIMEOUT_MS = 25_000;

interface SearchPlan {
  url: string;
  query: string;
}

export function FacebookSearchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const {
    preferences,
    setPreferences,
    beginVerification,
    completeVerification,
  } = useMarketplaceConnections();
  const [keyword, setKeyword] = useState("");
  const [area, setArea] = useState(preferences.requestedArea);
  const [radius, setRadius] = useState<number>(preferences.requestedRadiusKm);
  const [searchPlan, setSearchPlan] = useState<SearchPlan | null>(null);

  const persistPreferences = async () => {
    await setPreferences({
      requestedArea: area.trim(),
      requestedRadiusKm: radius as 10 | 30 | 64,
    });
  };

  const beginSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    await persistPreferences();
    // Facebook overrides the requested area/radius with the signed-in account's
    // own marketplace location. The URL only seeds the search; the effective
    // scope is chosen by Facebook inside the visible browser.
    setSearchPlan({
      url: buildFbSearchUrl({ query: trimmed, location: area, radiusKm: radius }),
      query: trimmed,
    });
  };

  const openExternally = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const url = buildFbSearchUrl({ query: trimmed, location: area, radiusKm: radius });
    void Linking.openURL(url).catch(() => showAlert("Couldn't open Facebook", "Please try again."));
  };

  const handleDone = async () => {
    const plan = searchPlan;
    setSearchPlan(null);
    if (!plan) return;
    const generation = beginVerification("facebook");
    const host = getWebViewHost();
    if (!host?.snapshot) {
      await completeVerification("facebook", generation, { kind: "unavailable" });
      onClose();
      return;
    }
    let snapshot;
    try {
      snapshot = await host.snapshot(plan.url, { timeoutMs: PROBE_TIMEOUT_MS });
    } catch {
      await completeVerification("facebook", generation, {
        kind: "unverified",
        checkedAt: new Date().toISOString(),
        reason: "network",
      });
      onClose();
      return;
    }
    // Done starts a real page-access probe. Tapping Done never marks the
    // marketplace ready on its own.
    await completeVerification(
      "facebook",
      generation,
      evaluateProbe({ capability: { kind: "search", query: plan.query }, snapshot }),
    );
    onClose();
  };

  return (
    <>
      <Modal visible={visible && !searchPlan} animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 48 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}>Facebook Marketplace</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
            Search local listings on Facebook. Results open in the visible app
            browser — sign in to Facebook there to see listings. The actual
            location and radius are chosen by Facebook; adjust them inside the
            browser. Copy a listing link and paste it into Add Product to track
            it.
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
            accessibilityLabel="Requested search location"
            placeholder="Requested location (e.g. Bangkok)"
            placeholderTextColor={colors.muted}
            value={area}
            onChangeText={setArea}
            style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {RADIUS_OPTIONS.map((km) => (
              <TouchableOpacity
                key={km}
                accessibilityRole="button"
                accessibilityLabel={`Requested radius ${km} kilometres`}
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
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
            Requested area/radius is a preference shared with inline search. If
            Facebook reports a different area, results are labelled with the
            observed one — never as matches inside your requested radius.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Search Facebook Marketplace"
            disabled={!keyword.trim()}
            onPress={() => void beginSearch()}
            style={{ backgroundColor: colors.tint, borderRadius: 12, padding: 14, alignItems: "center", opacity: !keyword.trim() ? 0.5 : 1 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Search in app browser
            </Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open in browser" onPress={openExternally} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 14 }}>Open in system browser instead</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {searchPlan && (
        <SessionAssistModal
          visible
          url={searchPlan.url}
          title="Facebook Marketplace"
          allowNavigation={(url) => isMarketplaceUrlAllowed("facebook", url)}
          onClose={() => setSearchPlan(null)}
          onDone={() => void handleDone()}
        />
      )}
    </>
  );
}

import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import { useColors } from "@/hooks/use-colors";

interface Props {
  visible: boolean;
  url: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
  allowNavigation?: (url: string) => boolean;
}

const NATIVE_WEB = /^(https?:|about:)/i;

/**
 * Decide whether the visible browser may itself load a URL. A marketplace
 * policy restricts the WebView to that site's own hosts; distributor callers
 * pass no policy and keep permissive web navigation. `about:blank` is always
 * allowed because some sites use an empty document as an internal anchor.
 */
export function navigationAllowed(
  url: string,
  allowNavigation?: (url: string) => boolean,
): boolean {
  if (/^about:blank$/i.test(url)) return true;
  if (allowNavigation) return allowNavigation(url);
  return NATIVE_WEB.test(url);
}

function originLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function openExternally(url: string): void {
  void Linking.openURL(url).catch(() => {});
}

/**
 * A visible WebView at a site so the user can solve a Cloudflare challenge or
 * sign in. It shares the system CookieManager and DOM storage with the hidden
 * fetch pool, so the warmed session is reused automatically. Marketplace
 * callers pass `allowNavigation` to keep the WebView on their own hosts and
 * get an explicit external-browser action for any other destination.
 */
export function SessionAssistModal({
  visible,
  url,
  title,
  onClose,
  onDone,
  allowNavigation,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState(() => originLabel(url));
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  const supported = Platform.OS !== "web";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        // Reset per-open state so a stale origin or blocked link from a
        // previous site can never leak into the next session.
        setLoading(true);
        setOrigin(originLabel(url));
        setBlockedUrl(null);
      }}
    >
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            // Inset below the status bar, or the buttons sit under it and the
            // system bar swallows taps on Close/Done.
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            zIndex: 1,
            elevation: 1,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>Close</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>{title}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
              {origin}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onDone} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>Done</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingTop: 8 }}>
          Sign in or complete the check, then tap Done.
        </Text>
        {loading && (
          <View style={{ height: 3, backgroundColor: colors.border }}>
            <View style={{ height: 3, width: "40%", backgroundColor: colors.primary }} />
          </View>
        )}
        {allowNavigation && blockedUrl && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }}>
              This link goes to another site and is blocked here. Opening it in
              your browser does not connect this app&apos;s session.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open in browser"
              onPress={() => openExternally(blockedUrl)}
              hitSlop={8}
              style={{ alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.primary }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                Open in browser
              </Text>
            </Pressable>
          </View>
        )}
        {supported ? (
          <WebView
            style={{ flex: 1 }}
            source={{ uri: url }}
            originWhitelist={["https://*", "http://*"]}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(state) => setOrigin(originLabel(state.url))}
            onShouldStartLoadWithRequest={(request) => {
              const allowed = navigationAllowed(request.url, allowNavigation);
              // Record the rejected destination instead of auto-opening it, so
              // an external browser only launches from an explicit tap.
              if (!allowed && allowNavigation && /^https?:/i.test(request.url)) {
                setBlockedUrl(request.url);
              }
              return allowed;
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, textAlign: "center" }}>
              The shared session browser is unavailable on this platform.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open in browser"
              onPress={() => openExternally(url)}
              hitSlop={8}
              style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Open in browser</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12, textAlign: "center" }}>
              Signing in through your browser does not establish a native app
              session.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { DistributorParser } from "@/lib/scrapers/types";
import { assistUrl } from "@/lib/scrapers/session-assist";
import { useColors } from "@/hooks/use-colors";

interface Props {
  visible: boolean;
  parser: DistributorParser;
  title: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * A visible WebView at the distributor's own site so the user can solve a
 * Cloudflare challenge or sign in. It shares the system CookieManager with the
 * hidden fetch pool, so the warmed session is reused automatically.
 */
export function SessionAssistModal({ visible, parser, title, onClose, onDone }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>Close</Text>
          </Pressable>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>{title}</Text>
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
        <WebView
          source={{ uri: assistUrl(parser) }}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={(r) => /^(https?:|about:)/i.test(r.url)}
        />
      </View>
    </Modal>
  );
}

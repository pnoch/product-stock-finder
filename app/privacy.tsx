import { ScrollView, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";

// Public privacy policy. Both the App Store and Play Store require a reachable
// privacy-policy URL, and the Settings screen links here. Keep the content
// accurate: it describes what the app actually stores and sends.
export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const updated = "September 18, 2026";

  const Section = ({ title, children }: { title: string; children: string }) => (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, lineHeight: 21 }}>
        {children}
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>
          Privacy Policy
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          Last updated {updated}
        </Text>

        <Section title="What we store">
          Your watchlist, price alerts, back-order reminders, restock watches, and
          app settings are stored locally on your device. If you create an
          account, they also sync to our server so they are available on your
          other devices.
        </Section>

        <Section title="Account data">
          If you sign in, we store your email address, an optional display name,
          a hashed password (never the password itself), and the devices you have
          signed in from. We use this only to authenticate you and to deliver the
          notifications you asked for.
        </Section>

        <Section title="Notifications">
          Price, restock, reminder, and digest notifications are generated from
          your own watchlist and alert settings. On mobile we register a push
          token with Expo; on the web we store a browser push subscription. You
          can disable notifications at any time in Settings.
        </Section>

        <Section title="Price data">
          Prices are fetched from public distributor websites. We do not send
          your watchlist or account details to those sites — only the product
          model being looked up.
        </Section>

        <Section title="What we do not do">
          We do not sell your data, and we do not use third-party advertising or
          tracking SDKs. We do not collect your contacts, photos, or precise
          location.
        </Section>

        <Section title="Data retention and deletion">
          You can delete your account and all associated data from Settings →
          Account → Delete Account. Deleting your account removes your synced
          watchlist, alerts, reminders, settings, and device records from our
          server.
        </Section>

        <Section title="Contact">
          Questions about this policy: support@productstockfinder.savvylife.icu
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

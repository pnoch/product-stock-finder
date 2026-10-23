import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { SessionAssistModal } from "@/components/session-assist-modal";
import { FacebookSearchSheet } from "@/components/marketplace/facebook-search-sheet";
import { ConnectedMarketplacesHeader } from "@/components/marketplace/connected-marketplaces-header";
import { MarketplaceConnectionCard } from "@/components/marketplace/marketplace-connection-card";
import { useColors } from "@/hooks/use-colors";
import { useConnectedMarketplaces } from "@/hooks/use-connected-marketplaces";
import { goBackOrHome } from "@/lib/navigation";
import {
  isMarketplaceUrlAllowed,
  MARKETPLACE_SITE_CONFIG,
} from "@/lib/marketplace/connections";

export default function ConnectedMarketplacesScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    loaded,
    orderedConnections,
    busySites,
    guidance,
    openPlan,
    setOpenPlan,
    fbSearchVisible,
    setFbSearchVisible,
    handleConnect,
    handleDone,
    handleCheckAgain,
    handleDisconnect,
  } = useConnectedMarketplaces();

  return (
    <ScreenContainer>
      <ConnectedMarketplacesHeader
        colors={colors}
        onBack={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          goBackOrHome(router);
        }}
      />

      {!loaded ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {orderedConnections.map((connection) => (
            <MarketplaceConnectionCard
              key={connection.site}
              colors={colors}
              site={connection.site}
              label={connection.label}
              verification={connection.verification}
              busy={busySites.has(connection.site)}
              note={guidance[connection.site]}
              onConnect={() => handleConnect(connection.site)}
              onCheckAgain={() => handleCheckAgain(connection.site)}
              onDisconnect={() => void handleDisconnect(connection.site)}
              onSearchFacebook={() => setFbSearchVisible(true)}
            />
          ))}
        </ScrollView>
      )}

      {openPlan && (
        <SessionAssistModal
          visible
          url={openPlan.url}
          title={MARKETPLACE_SITE_CONFIG[openPlan.site].label}
          allowNavigation={(url) => isMarketplaceUrlAllowed(openPlan.site, url)}
          onClose={() => setOpenPlan(null)}
          onDone={handleDone}
        />
      )}

      <FacebookSearchSheet
        visible={fbSearchVisible}
        onClose={() => setFbSearchVisible(false)}
      />
    </ScreenContainer>
  );
}

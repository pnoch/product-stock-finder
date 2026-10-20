import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "@/components/settings/section-header";
import {
  JoinedSharedList,
  SharedLinksList,
  ShareWatchlistButton,
} from "@/components/settings/shared-links";

export function CollaborativeWatchlistSection({
  isAuthenticated,
  onSignIn,
}: {
  isAuthenticated: boolean;
  onSignIn: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <SectionHeader title="Collaborative Watchlist" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          padding: 16,
          gap: 8,
        }}
      >
        <Text style={{ color: colors.foreground, fontWeight: "600" }}>
          Share watchlist
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Create a read-only link to your watchlist. Anyone with the link can
          view it unless you make it members-only.
        </Text>
        <ShareWatchlistButton
          isAuthenticated={isAuthenticated}
          onSignIn={onSignIn}
        />
        {isAuthenticated && <SharedLinksList />}
        {isAuthenticated && <JoinedSharedList />}
      </View>
    </>
  );
}

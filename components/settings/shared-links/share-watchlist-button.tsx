import { useCallback, useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { trpc } from "@/lib/trpc";
import { showAlert } from "@/lib/alert";
import { shareText } from "@/lib/share-text";
import { useColors } from "@/hooks/use-colors";

export function ShareWatchlistButton({
  isAuthenticated,
  onSignIn,
}: {
  isAuthenticated: boolean;
  onSignIn: () => void;
}) {
  const colors = useColors();
  const createMutation = trpc.sharedWatchlists.create.useMutation();
  const [sharing, setSharing] = useState(false);
  const handleShare = useCallback(async () => {
    if (sharing) return;
    // The endpoint is sign-in only; without this guard a signed-out tap showed
    // the raw server error "Please login (10001)" instead of a way to sign in.
    if (!isAuthenticated) {
      showAlert(
        "Sign in to share",
        "Create a free account to generate a public watchlist link.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: onSignIn },
        ],
      );
      return;
    }
    setSharing(true);
    try {
      const res = await createMutation.mutateAsync({});
      const result = await shareText(res.shareUrl);
      if (result === "copied") showAlert("Copied", "Share link copied to your clipboard.");
    } catch (e) {
      showAlert("Share failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [sharing, createMutation, isAuthenticated, onSignIn]);
  return (
    <TouchableOpacity
      onPress={handleShare}
      disabled={sharing || createMutation.isPending}
      accessibilityLabel="Share watchlist"
      accessibilityRole="button"
      accessibilityState={{ disabled: sharing || createMutation.isPending }}
      style={{
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        opacity: sharing || createMutation.isPending ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>
        {sharing || createMutation.isPending ? "Creating link…" : "Share watchlist"}
      </Text>
    </TouchableOpacity>
  );
}

import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";
import { shareText } from "@/lib/share-text";
import { SharedLinkMembers } from "./shared-link-members";

export function SharedLinksList() {
  const colors = useColors();
  const listQuery = trpc.sharedWatchlists.list.useQuery();
  const extendMutation = trpc.sharedWatchlists.extend.useMutation();
  const revokeMutation = trpc.sharedWatchlists.revoke.useMutation();
  const membersOnlyMutation = trpc.sharedWatchlists.setMembersOnly.useMutation();
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const links = listQuery.data?.links ?? [];

  const setMembersOnly = async (token: string, next: boolean) => {
    if (busyToken) return;
    setBusyToken(token);
    try {
      await membersOnlyMutation.mutateAsync({ token, membersOnly: next });
      await listQuery.refetch();
    } catch (e) {
      showAlert("Update failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusyToken(null);
    }
  };

  const runFor = async (token: string, action: "extend" | "revoke" | "copy") => {
    if (busyToken) return;
    if (action === "copy") {
      const link = links.find((l) => l.token === token);
      if (link) {
        const result = await shareText(link.shareUrl);
        if (result === "copied") showAlert("Copied", "Share link copied to your clipboard.");
        else if (result === "failed") showAlert("Copy failed", "Couldn't copy the link in this browser.");
      }
      return;
    }
    setBusyToken(token);
    try {
      if (action === "extend") {
        const res = await extendMutation.mutateAsync({ token });
        await listQuery.refetch();
        showAlert("Link extended", `Now expires ${new Date(res.expiresAt).toLocaleDateString()}.`);
      } else {
        await revokeMutation.mutateAsync({ token });
        await listQuery.refetch();
        showAlert("Link revoked", "The share link no longer works.");
      }
    } catch (e) {
      showAlert(action === "extend" ? "Extend failed" : "Revoke failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusyToken(null);
    }
  };

  if (listQuery.isLoading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }
  if (listQuery.isError || links.length === 0) return null;

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      {links.map((link) => {
        const busy = busyToken === link.token;
        const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < now : false;
        return (
          <View
            key={link.token}
            style={{
              backgroundColor: colors.background,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
              {link.title}
            </Text>
            <Text style={{ color: expired ? colors.error : colors.muted, fontSize: 12 }}>
              {link.expiresAt ? `${expired ? "Expired" : "Expires"} ${new Date(link.expiresAt).toLocaleDateString()}` : "No expiry"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(
                [
                  { action: "copy", label: "Copy" },
                  { action: "extend", label: "Extend 30d" },
                  { action: "revoke", label: "Revoke" },
                ] as const
              ).map(({ action, label }) => (
                <TouchableOpacity activeOpacity={0.85}
                  key={action}
                  onPress={() => void runFor(link.token, action)}
                  disabled={busy}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: busy ? 0.5 : 1,
                  }}
                  accessibilityLabel={`${label} share link ${link.title}`}
                  accessibilityRole="button"
                >
                  <Text style={{ color: action === "revoke" ? colors.error : colors.primary, fontSize: 12, fontWeight: "600" }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!expired && (
              <SharedLinkMembers
                token={link.token}
                membersOnly={link.membersOnly}
                onToggleMembersOnly={(next) => void setMembersOnly(link.token, next)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

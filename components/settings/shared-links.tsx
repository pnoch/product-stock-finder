import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";
import { shareText } from "@/lib/share-text";

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

// Owner-side member roster + invite-by-email for one share link.
function SharedLinkMembers({
  token,
  membersOnly,
  onToggleMembersOnly,
}: {
  token: string;
  membersOnly: boolean;
  onToggleMembersOnly: (next: boolean) => void;
}) {
  const colors = useColors();
  const membersQuery = trpc.sharedWatchlists.members.useQuery({ token });
  const inviteMutation = trpc.sharedWatchlists.inviteByEmail.useMutation();
  const removeMutation = trpc.sharedWatchlists.removeMember.useMutation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const members = membersQuery.data?.members ?? [];

  const invite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await inviteMutation.mutateAsync({ token, email: email.trim() });
      await membersQuery.refetch();
      setEmail("");
      showAlert("Invited", "They can now view this share.");
    } catch (e) {
      showAlert("Invite failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeMutation.mutateAsync({ token, userId });
      await membersQuery.refetch();
    } catch (e) {
      showAlert("Remove failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6, marginTop: 4 }}>
      <TouchableOpacity activeOpacity={0.85}
        onPress={() => onToggleMembersOnly(!membersOnly)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: membersOnly }}
        accessibilityLabel="Members only"
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: membersOnly ? colors.primary : "transparent",
          }}
        >
          {membersOnly && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Members only (the link alone won&apos;t work)
        </Text>
      </TouchableOpacity>
      {members.map((m) => {
        const label = m.name ?? m.email ?? `User ${m.userId}`;
        return (
          <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
              {label}
            </Text>
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => void removeMember(m.userId)}
              disabled={busy}
              accessibilityLabel={`Remove ${label}`}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Remove</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      {members.length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>No members yet</Text>
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Invite by email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="Invite member by email"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            color: colors.foreground,
            fontSize: 12,
            backgroundColor: colors.surface,
          }}
        />
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => void invite()}
          disabled={busy || !email.trim()}
          accessibilityLabel="Send invite"
          accessibilityRole="button"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 6,
            opacity: busy || !email.trim() ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Invite</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
// Shares the signed-in user was invited to / joined ("Shared with me").
export function JoinedSharedList() {
  const colors = useColors();
  const router = useRouter();
  const joinedQuery = trpc.sharedWatchlists.listJoined.useQuery();
  const leaveMutation = trpc.sharedWatchlists.leave.useMutation();
  const [busy, setBusy] = useState(false);
  const shares = joinedQuery.data?.shares ?? [];

  if (joinedQuery.isLoading || shares.length === 0) return null;

  const leave = async (token: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveMutation.mutateAsync({ token });
      await joinedQuery.refetch();
    } catch (e) {
      showAlert("Leave failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const actionStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  } as const;

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      {shares.map((s) => (
        <View
          key={s.token}
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
            {s.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            Shared by {s.ownerName ?? "another user"}
            {s.membersOnly ? " · members only" : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/w/[token]", params: { token: s.token } })}
              accessibilityLabel={`Open ${s.title}`}
              accessibilityRole="button"
              style={actionStyle}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => void leave(s.token)}
              disabled={busy}
              accessibilityLabel={`Leave ${s.title}`}
              accessibilityRole="button"
              style={{ ...actionStyle, opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Leave</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

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


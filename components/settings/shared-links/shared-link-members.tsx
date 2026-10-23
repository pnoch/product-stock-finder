import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";

export function SharedLinkMembers({
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

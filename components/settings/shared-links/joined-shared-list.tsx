import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";

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

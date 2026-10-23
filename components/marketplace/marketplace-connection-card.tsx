import { Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { MarketplaceSite, Verification } from "@/lib/marketplace/connections";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

const MISSING_CONTEXT_GUIDANCE =
  "Open this screen from a product listing or a search result to verify access.";

function statusLabel(verification: Verification): string {
  switch (verification.kind) {
    case "ready":
      return "Connected";
    case "checking":
      return "Checking access…";
    case "unverified":
      return "Not verified";
    case "unavailable":
      return "Check unavailable";
    default:
      return "Not connected";
  }
}

function verificationTime(verification: Verification): string | null {
  if (verification.kind === "ready" || verification.kind === "unverified") {
    return verification.checkedAt
      ? new Date(verification.checkedAt).toLocaleString()
      : null;
  }
  return null;
}

function statusColor(verification: Verification, colors: Colors): string {
  switch (verification.kind) {
    case "ready":
      return colors.success;
    case "checking":
      return colors.primary;
    case "unverified":
      return colors.warning;
    case "unavailable":
      return colors.muted;
    default:
      return colors.border;
  }
}

export function MarketplaceConnectionCard({
  colors,
  site,
  label,
  verification,
  busy,
  note,
  onConnect,
  onCheckAgain,
  onDisconnect,
  onSearchFacebook,
}: {
  colors: Colors;
  site: MarketplaceSite;
  label: string;
  verification: Verification;
  busy: boolean;
  note?: string;
  onConnect: () => void;
  onCheckAgain: () => void;
  onDisconnect: () => void;
  onSearchFacebook: () => void;
}) {
  const canDisconnect = verification.kind !== "not_checked";
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconSymbol name="globe" size={20} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, flex: 1 }}>
          {label}
        </Text>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: statusColor(verification, colors),
          }}
        />
      </View>

      <Text style={{ color: colors.foreground, fontSize: 14 }}>
        {statusLabel(verification)}
      </Text>
      {verificationTime(verification) && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Last verified {verificationTime(verification)}
        </Text>
      )}
      {verification.kind === "unverified" && (
        <Text style={{ color: colors.warning, fontSize: 12 }}>
          {verification.reason === "missing-context"
            ? MISSING_CONTEXT_GUIDANCE
            : `Reason: ${verification.reason}`}
        </Text>
      )}

      {note && <Text style={{ color: colors.muted, fontSize: 12 }}>{note}</Text>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${verification.kind === "ready" ? "Reconnect" : "Connect"} ${label}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onConnect}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: colors.primary,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
            {verification.kind === "ready" ? "Reconnect" : "Connect"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Check ${label} again`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onCheckAgain}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
            {verification.kind === "checking" ? "Checking…" : "Check again"}
          </Text>
        </TouchableOpacity>

        {verification.kind === "unverified" && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Retry ${label}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onCheckAgain}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.primary,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
              Retry
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Disconnect ${label}`}
          accessibilityState={{ disabled: busy || !canDisconnect }}
          disabled={busy || !canDisconnect}
          onPress={onDisconnect}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.error,
            opacity: busy || !canDisconnect ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>
            Disconnect
          </Text>
        </TouchableOpacity>
      </View>

      {site === "facebook" && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search Facebook Marketplace"
          onPress={onSearchFacebook}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            Search Facebook Marketplace…
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

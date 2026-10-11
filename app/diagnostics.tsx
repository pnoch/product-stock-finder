import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useToast } from "@/components/ui/toast";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDeviceId } from "@/lib/device-id";
import { goBackOrHome } from "@/lib/navigation";
import {
  fetchPushStatusAll,
  sendTestPush,
  pushErrorHelpText,
  type PushStatusDevice,
} from "@/lib/server-notifications";
import { formatLastRefreshed } from "@/lib/last-refreshed";

function StatusIcon({ device }: { device: PushStatusDevice }) {
  const colors = useColors();
  if (!device.outcome) {
    return <IconSymbol name="info.circle.fill" size={28} color={colors.muted} />;
  }
  if (device.outcome.status === "ok") {
    return (
      <IconSymbol name="checkmark.circle.fill" size={28} color={colors.success} />
    );
  }
  return <IconSymbol name="xmark.circle.fill" size={28} color={colors.error} />;
}

function DeviceCard({
  device,
  isMine,
  testing,
  onTest,
}: {
  device: PushStatusDevice;
  isMine: boolean;
  testing: boolean;
  onTest: (deviceId: string) => void;
}) {
  const colors = useColors();
  const outcome = device.outcome;
  const name = device.label ?? `${device.deviceId.slice(0, 12)}…`;
  const statusText = !outcome
    ? "No pushes sent yet"
    : outcome.status === "ok"
      ? `Delivered · ${formatLastRefreshed(new Date(outcome.sentAt).toISOString())}`
      : `Failed: ${outcome.error} · ${formatLastRefreshed(new Date(outcome.sentAt).toISOString())}`;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <StatusIcon device={device} />
        <Text
          style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {isMine && (
          <View
            style={{
              backgroundColor: colors.success + "22",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: colors.success, fontSize: 11, fontWeight: "700" }}>
              This device
            </Text>
          </View>
        )}
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
            {device.platform ?? "unknown"}
          </Text>
        </View>
      </View>

      <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 10 }}>
        {statusText}
      </Text>
      {outcome?.error && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
          {pushErrorHelpText(outcome.error)}
        </Text>
      )}

      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
        Push token: {device.hasToken ? "Yes" : "No"}
      </Text>
      {outcome && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
          Last batch: {outcome.eventCount} event(s)
        </Text>
      )}
      {outcome?.ticketId && (
        <Text
          style={{ color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
          numberOfLines={1}
        >
          Ticket: {outcome.ticketId.slice(0, 16)}…
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={testing}
        onPress={() => onTest(device.deviceId)}
        accessibilityLabel={`Send test push to ${name}`}
        accessibilityRole="button"
        style={{
          marginTop: 12,
          borderWidth: 1,
          borderColor: testing ? colors.border : colors.primary,
          borderRadius: 10,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: testing ? 0.6 : 1,
        }}
      >
        {testing && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
          {testing ? "Sending…" : "Send test push"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const [devices, setDevices] = useState<PushStatusDevice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [list, mine] = await Promise.all([
        fetchPushStatusAll(),
        getDeviceId().catch(() => null),
      ]);
      setDevices(list);
      setMyDeviceId(mine);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load diagnostics");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onTest = useCallback(
    async (deviceId: string) => {
      setTestingId(deviceId);
      try {
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        const outcome = await sendTestPush();
        await load();
        if (outcome?.status === "ok") {
          showToast("Test push delivered ✅", "success");
        } else {
          showToast(`Test push failed: ${pushErrorHelpText(outcome?.error ?? "unknown")}`, "error");
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Test push failed", "error");
      } finally {
        setTestingId(null);
      }
    },
    [load, showToast],
  );

  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            goBackOrHome(router);
          }}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Push Diagnostics
        </Text>
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityLabel="Refresh diagnostics"
            accessibilityRole="button"
            onPress={() => void onRefresh()}
            style={{ padding: 4 }}
            hitSlop={12}
          >
            <IconSymbol name="arrow.clockwise" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {devices === null && !loadError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
            Loading diagnostics...
          </Text>
        </View>
      ) : loadError ? (
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <IconSymbol name="exclamationmark.triangle" size={28} color={colors.error} />
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 8 }}>
              Couldn&apos;t load diagnostics
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
              {loadError}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => void load()}
              accessibilityLabel="Retry loading diagnostics"
              accessibilityRole="button"
              style={{
                marginTop: 12,
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={devices ?? []}
          keyExtractor={(d) => d.deviceId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 32 }}>
              <IconSymbol name="bell.badge.fill" size={40} color={colors.muted} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: "600",
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No devices yet
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center" }}>
                No devices with push tokens yet — open the app on a device while signed in.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              isMine={item.deviceId === myDeviceId}
              testing={testingId === item.deviceId}
              onTest={(id) => void onTest(id)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";

import { ScreenContainer } from "@/components/screen-container";
import { sanitizeResponseTimeMs } from "@/lib/scrapers/health";
import { getDistributorById } from "@shared/distributors";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { SessionAssistModal } from "@/components/session-assist-modal";
import { assistUrl, isAssistCandidate } from "@/lib/scrapers/session-assist";
import { PARSERS } from "@/lib/scrapers/registry";
import { useHealthScreen } from "@/hooks/use-health-screen";
import { HealthSparkline } from "@/components/health/health-sparkline";

export default function HealthScreen() {
  const router = useRouter();
  const {
    colors,
    health,
    filter,
    setFilter,
    loading,
    testing,
    progress,
    stats,
    assistParserId,
    setAssistParserId,
    resolveStatusColor,
    runTest,
    handleAssistDone,
    counts,
    filtered,
  } = useHealthScreen();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            goBackOrHome(router);
          }}
          style={{ marginRight: 12 }}
          hitSlop={12}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          Distributor Health
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          paddingHorizontal: 16,
          marginBottom: 12,
          gap: 8,
        }}
      >
        {(["all", "working", "blocked", "error"] as const).map((f) => (
          <TouchableOpacity activeOpacity={0.85}
            key={f}
            accessibilityLabel={`Filter by ${f}`}
            accessibilityRole="button"
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter(f);
            }}
            hitSlop={6}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: filter === f ? "#fff" : colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {f === "all" ? `All (${health.length})` : `${f} (${counts[f]})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity activeOpacity={0.85}
        accessibilityLabel="Test All Distributors"
        accessibilityRole="button"
        accessibilityState={{ disabled: testing }}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          void runTest();
        }}
        disabled={testing}
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          opacity: testing ? 0.5 : 1,
        }}
      >
        {testing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Test All Distributors
          </Text>
        )}
      </TouchableOpacity>

      {testing && (
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                width: `${progress}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {progress}%
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Loading distributor health...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          return (
            <TouchableOpacity activeOpacity={0.7}
              key={h.distributorId}
              accessibilityLabel={`${distributor?.name ?? h.distributorId}, ${h.status}`}
              accessibilityRole="button"
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/health/${h.distributorId}`);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: resolveStatusColor(h),
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 14,
                  }}
                >
                  {distributor ? `${distributor.countryCode} ${distributor.name}` : h.distributorId}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {h.reason || h.status}
                  {sanitizeResponseTimeMs(h.responseTimeMs) != null
                    ? ` · ${sanitizeResponseTimeMs(h.responseTimeMs)}ms`
                    : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {formatLastRefreshed(h.lastChecked)}
                </Text>
                {stats[h.distributorId] ? (
                  <>
                    <Text
                      style={{
                        color: resolveStatusColor(h),
                        fontSize: 12,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {stats[h.distributorId].uptimePct}%{" "}
                      {stats[h.distributorId].trend === "up"
                        ? "▲"
                        : stats[h.distributorId].trend === "down"
                          ? "▼"
                          : "–"}
                    </Text>
                    <HealthSparkline
                      data={stats[h.distributorId].sparkline}
                      color={resolveStatusColor(h)}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    –
                  </Text>
                )}
              </View>
              {isAssistCandidate(h.status, h.reason) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Unlock ${distributor?.name ?? h.distributorId}`}
                  hitSlop={8}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setAssistParserId(h.distributorId);
                  }}
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                    Unlock
                  </Text>
                </Pressable>
              )}
            </TouchableOpacity>
          );
        })}
          {health.length === 0 ? (
            <EmptyStateView
              icon="heart.slash"
              title="No distributor health data"
              subtitle='Tap "Test All Distributors" to run a check.'
              ctaLabel="Test All Distributors"
              onCtaPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                runTest();
              }}
            />
          ) : filtered.length === 0 ? (
            <EmptyStateView
              icon="line.3.horizontal.decrease.circle"
              title="No matches"
              subtitle="No distributors match the selected filter."
              ctaLabel="Show All"
              onCtaPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter("all");
              }}
            />
          ) : null}
        </ScrollView>
      )}

      {assistParserId && (
        <SessionAssistModal
          visible
          url={assistUrl(PARSERS.find((p) => p.id === assistParserId)!)}
          title={getDistributorById(assistParserId)?.name ?? assistParserId}
          onClose={() => setAssistParserId(null)}
          onDone={() => void handleAssistDone()}
        />
      )}
    </ScreenContainer>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import {
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  groupSamplesByDay,
  HealthSample,
  HealthStatus,
  timelineSegments,
} from "@/lib/scrapers/health";
import { getDistributorById } from "@shared/distributors";

const healthService = createHealthService(AsyncStorage);

export default function HealthDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [currentStatus, setCurrentStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const distributor = id ? getDistributorById(id) : undefined;

  const statusColors: Record<HealthStatus, string> = {
    working: colors.success,
    blocked: colors.warning,
    error: colors.error,
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const history = await healthService.getHealthHistory();
      setSamples(history[id] ?? []);
      const health = await healthService.getDistributorHealth();
      const entry = health.find((h) => h.distributorId === id);
      setCurrentStatus(entry?.status ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!distributor) {
    return (
      <ScreenContainer>
        <EmptyStateView
          icon="magnifyingglass"
          title="Distributor not found"
          subtitle="We couldn't find this distributor. Check the link or browse distributor health."
          ctaLabel="Go back"
          onCtaPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            goBackOrHome(router, "/health");
          }}
        />
      </ScreenContainer>
    );
  }

  const stats = computeHealthStats(
    samples.length > 0 ? { [id]: samples } : {},
  )[id];
  const summary = computeHealthSummary(samples);
  const segments = timelineSegments(samples);
  const groups = groupSamplesByDay(samples);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity activeOpacity={0.85}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            goBackOrHome(router, "/health");
          }}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          {distributor.countryFlag} {distributor.name}
        </Text>
      </View>

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 60,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
            Loading health history...
          </Text>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: currentStatus
                  ? statusColors[currentStatus]
                  : colors.muted,
                marginRight: 8,
              }}
            />
            <Text
              style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}
            >
              {currentStatus ?? "No data"}
            </Text>
          </View>
          {stats ? (
            <>
              <Text
                style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}
              >
                {stats.uptimePct}%{" "}
                {stats.trend === "up" ? "▲" : stats.trend === "down" ? "▼" : "–"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                {summary.count} samples · first{" "}
                {summary.firstAt
                  ? new Date(summary.firstAt).toLocaleDateString()
                  : "–"}{" "}
                · last{" "}
                {summary.lastAt
                  ? new Date(summary.lastAt).toLocaleDateString()
                  : "–"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                avg response{" "}
                {summary.avgResponseTimeMs != null
                  ? `${summary.avgResponseTimeMs}ms`
                  : "–"}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
              No health history yet. Run Test All or wait for scheduled probes.
            </Text>
          )}
          {segments.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              {segments.map((seg, i) => (
                <View
                  key={i}
                  style={{
                    flex: seg.weight,
                    backgroundColor: statusColors[seg.status],
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {groups.map((g) => {
          const working = g.samples.filter((s) => s.status === "working").length;
          const workingPct = Math.round((working / g.samples.length) * 100);
          return (
            <View key={g.day}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                {new Date(g.day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {g.samples.length} samples · {workingPct}% working
              </Text>
              {g.samples.map((s, i) => (
                <View
                  key={`${s.at}-${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: statusColors[s.status],
                      marginRight: 10,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: "500",
                      }}
                    >
                      {new Date(s.at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {s.reason || s.status}
                      {s.responseTimeMs ? ` · ${s.responseTimeMs}ms` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {groups.length === 0 && (
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No health history yet. Run Test All or wait for scheduled probes.
          </Text>
        )}
      </ScrollView>
      )}
    </ScreenContainer>
  );
}
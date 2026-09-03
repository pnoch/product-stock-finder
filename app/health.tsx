import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  computeHealthStats,
  createHealthService,
  DistributorHealth,
  HealthStats,
  HealthStatus,
} from "@/lib/scrapers/health";
import { getDistributorById } from "@/lib/distributors";
import { classifyFetchStatus } from "@/lib/scrapers/resilient";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { EmptyStateView } from "@/components/ui/empty-state-view";

const healthService = createHealthService(AsyncStorage);

function HealthSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const width = 60;
  const height = 24;
  const pad = 2;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const coords = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * usableW;
    const y = pad + (1 - v) * usableH;
    return `${x},${y}`;
  });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<"all" | "working" | "blocked" | "error">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Record<string, HealthStats>>({});
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const statusColors: Record<HealthStatus, string> = {
    working: colors.success,
    blocked: colors.warning,
    error: colors.error,
  };

  function resolveStatusColor(h: DistributorHealth): string {
    if (h.status === "blocked") return colors.warning;
    if (h.reason && classifyFetchStatus(h.reason) === "blocked") return colors.warning;
    return statusColors[h.status];
  }

  const loadHealth = useCallback(async () => {
    try {
      const data = await healthService.getDistributorHealth();
      setHealth(data);
      const history = await healthService.getHealthHistory();
      setStats(computeHealthStats(history));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    try {
      const results = await healthService.testAllDistributors(
        (current, total) => {
          if (isMountedRef.current) setProgress(Math.round((current / total) * 100));
        },
      );
      if (!isMountedRef.current) return;
      setHealth(results);
      const history = await healthService.getHealthHistory();
      if (!isMountedRef.current) return;
      setStats(computeHealthStats(history));
    } finally {
      if (isMountedRef.current) setTesting(false);
    }
  }, []);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter(
    (h) => filter === "all" || h.status === filter,
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={{ marginRight: 12 }}
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
          runTest();
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
                  {distributor ? `${distributor.countryFlag} ${distributor.name}` : h.distributorId}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
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
    </ScreenContainer>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
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
    <Svg width={width} height={height}>
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
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Record<string, HealthStats>>({});

  const statusColors: Record<HealthStatus, string> = {
    working: colors.success,
    blocked: colors.warning,
    error: colors.error,
  };

  const loadHealth = useCallback(async () => {
    const data = await healthService.getDistributorHealth();
    setHealth(data);
    const history = await healthService.getHealthHistory();
    setStats(computeHealthStats(history));
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
          setProgress(Math.round((current / total) * 100));
        },
      );
      setHealth(results);
      const history = await healthService.getHealthHistory();
      setStats(computeHealthStats(history));
    } finally {
      setTesting(false);
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
          onPress={() => router.back()}
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
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        {(["all", "working", "blocked", "error"] as const).map((f) => (
          <TouchableOpacity activeOpacity={0.85}
            key={f}
            accessibilityLabel={`Filter by ${f}`}
            accessibilityRole="button"
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              marginRight: 8,
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
        onPress={runTest}
        disabled={testing}
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        }}
      >
        {testing ? (
          <ActivityIndicator color="#fff" />
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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          if (!distributor) return null;
          return (
            <TouchableOpacity activeOpacity={0.7}
              key={h.distributorId}
              accessibilityLabel={`${distributor.name}, ${h.status}`}
              accessibilityRole="button"
              onPress={() => router.push(`/health/${h.distributorId}`)}
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
                  backgroundColor: statusColors[h.status],
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
                  {distributor.countryFlag} {distributor.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {h.lastChecked
                    ? new Date(h.lastChecked).toLocaleTimeString()
                    : "Never"}
                </Text>
                {stats[h.distributorId] ? (
                  <>
                    <Text
                      style={{
                        color: statusColors[h.status],
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
                      color={statusColors[h.status]}
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
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No distributor health data. Tap &quot;Test All Distributors&quot; to
            run a check.
          </Text>
        ) : filtered.length === 0 ? (
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No distributors match the selected filter.
          </Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

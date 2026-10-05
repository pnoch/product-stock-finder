import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import { getDistributorById } from "@shared/distributors";
import { PARSERS } from "@/lib/scrapers/registry";
import { createHealthService, type DistributorHealth } from "@/lib/scrapers/health";
import {
  clearDistributorSession,
  clearSiteData,
  isAssistCandidate,
} from "@/lib/scrapers/session-assist";
import { getUnlocked } from "@/lib/scrapers/session-store";
import { SessionAssistModal } from "@/components/session-assist-modal";

const healthService = createHealthService(AsyncStorage);

type Hint = "active" | "expired" | "none";

function hintFor(id: string, unlocked: boolean, status?: string, reason?: string): Hint {
  if (!unlocked) return "none";
  if (status === "working") return "active";
  if (isAssistCandidate(status, reason)) return "expired";
  return "active";
}

export function SiteSessionsSection() {
  const colors = useColors();
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [u, h] = await Promise.all([
      getUnlocked(),
      healthService.getDistributorHealth(),
    ]);
    setUnlocked(u);
    setHealth(h);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = new Map(health.map((h) => [h.distributorId, h]));
  const relevant = PARSERS.filter((p) => {
    if (showAll) return true;
    const h = byId.get(p.id);
    return !!unlocked[p.id] || isAssistCandidate(h?.status, h?.reason);
  });

  async function handleClear(id: string) {
    const parser = PARSERS.find((p) => p.id === id);
    if (!parser) return;
    setBusy(true);
    try {
      await clearDistributorSession(parser);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    try {
      await clearSiteData();
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
        Site sessions
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        Sign-ins and challenge passes for distributor sites are stored only on
        this device, never synced.
      </Text>

      {relevant.map((p) => {
        const h = byId.get(p.id);
        const hint = hintFor(p.id, !!unlocked[p.id], h?.status, h?.reason);
        const name = getDistributorById(p.id)?.name ?? p.id;
        const hintColor =
          hint === "active" ? colors.success : hint === "expired" ? colors.warning : colors.muted;
        const hintLabel =
          hint === "active" ? "Active" : hint === "expired" ? "Expired — unlock again" : "None";
        return (
          <View
            key={p.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>
                {name}
              </Text>
              <Text style={{ color: hintColor, fontSize: 12 }}>{hintLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Unlock ${name}`}
              onPress={() => setAssistId(p.id)}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderRadius: 12, backgroundColor: colors.primary }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Unlock</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Clear ${name}`}
              disabled={busy}
              onPress={() => handleClear(p.id)}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.error }}
            >
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>Clear</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show all distributors"
          onPress={() => setShowAll((v) => !v)}
          hitSlop={8}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
            {showAll ? "Show relevant" : "Show all 25"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all sessions"
          disabled={busy}
          onPress={handleClearAll}
          hitSlop={8}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.error, opacity: busy ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
            Clear all sessions
          </Text>
        </Pressable>
      </View>

      {assistId && (
        <SessionAssistModal
          visible
          parser={PARSERS.find((p) => p.id === assistId)!}
          title={getDistributorById(assistId)?.name ?? assistId}
          onClose={() => setAssistId(null)}
          onDone={() => {
            setAssistId(null);
            void load();
          }}
        />
      )}
    </View>
  );
}

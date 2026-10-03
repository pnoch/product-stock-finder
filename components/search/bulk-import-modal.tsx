import { log } from "@shared/log";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";
import { runDiscoveryBatch } from "@/lib/bulk-discovery";
import { discoverListings } from "@/lib/listing-discovery";
import { addToWatchlist, updateProductListings } from "@/lib/storage";
import { matchModels, parseModelInputDetailed } from "@/lib/bulk-import";

const PREVIEW_LIMIT = 5;

export function BulkImportModal({
  visible,
  onClose,
  trackedIds,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  trackedIds: Set<string>;
  onImported?: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [discoveryNote, setDiscoveryNote] = useState<string | null>(null);

  const parsedInput = useMemo(() => parseModelInputDetailed(text), [text]);
  const preview = useMemo(
    () => matchModels(parsedInput.models),
    [parsedInput.models],
  );
  const newProducts = preview.matched.filter((p) => !trackedIds.has(p.id));
  const alreadyTracked = preview.matched.length - newProducts.length;
  const canImport = !importing && newProducts.length > 0;

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      // Chunked with yields, like the CSV import: firing one full-list rewrite
      // per product at once janked the UI and spiked memory on a big paste.
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < newProducts.length; i += 50) {
        const chunk = newProducts.slice(i, i + 50);
        const settled = await Promise.allSettled(
          chunk.map((item) =>
            addToWatchlist({
              ...item,
              addedAt: new Date().toISOString(),
              isWatched: true,
              listings: [],
            }),
          ),
        );
        results.push(...settled);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      // `addToWatchlist` RESOLVES false for an already-tracked product, so a
      // rejected-status check alone reported more imports than actually landed.
      // Count only fulfilled writes whose value is true.
      const addedCount = results.filter(
        (r) => r.status === "fulfilled" && r.value === true,
      ).length;
      const failedCount = results.length - addedCount;
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected") {
          log.warn("[BulkImport] Skipping", newProducts[i].modelNumber, (results[i] as PromiseRejectedResult).reason);
        }
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const unmatchedNote =
        preview.unmatched.length > 0
          ? `\n${preview.unmatched.length} not found in catalog.`
          : "";
      const truncatedNote = parsedInput.truncated
        ? `\nOnly the first ${parsedInput.models.length} models were imported.`
        : "";
      const summary =
        `${addedCount} added · ${alreadyTracked} already tracked` +
        `${failedCount > 0 ? ` · ${failedCount} failed` : ""}.` +
        `${unmatchedNote}${truncatedNote}`;

      const addedProducts = newProducts.filter((_, i) => {
        const settled = results[i];
        return settled?.status === "fulfilled" && settled.value === true;
      });

      let next = 0;
      let discovered = 0;
      let prompt: string | null = null;

      if (addedProducts.length > 0) {
        const items = addedProducts.map((p) => ({
          productId: p.id,
          modelNumber: p.modelNumber,
        }));
        const storage = { updateProductListings };
        const runBatch = async (showProgress: boolean) => {
          try {
            const res = await runDiscoveryBatch({
              items,
              startIndex: next,
              storage,
              discover: discoverListings,
              onProgress: showProgress
                ? (done, total, model) =>
                    setDiscoveryNote(`Finding prices ${done}/${total} — ${model}…`)
                : undefined,
            });
            next = res.nextIndex;
            discovered += res.discovered;
          } finally {
            setDiscoveryNote(null);
          }
        };
        await runBatch(true);
        if (next < items.length) {
          const remaining = items.length - next;
          prompt =
            `${summary}\n\nFetched prices for the first ${next} product${next === 1 ? "" : "s"}` +
            `${discovered > 0 ? ` (${discovered} listing${discovered === 1 ? "" : "s"})` : ""}. ` +
            `Fetch prices for the remaining ${remaining}?`;
          showAlert("Import Complete", prompt, [
            { text: "Later", style: "cancel" },
            {
              text: "Fetch",
              onPress: () => {
                void (async () => {
                  try {
                    while (next < items.length) await runBatch(false);
                  } catch {
                    // best-effort; the repair CTA covers anything left
                  }
                })();
              },
            },
          ]);
        }
      }

      if (prompt === null) {
        showAlert(
          "Import Complete",
          discovered > 0
            ? `${summary}\nFound ${discovered} listing${discovered === 1 ? "" : "s"}.`
            : summary,
        );
      }
      setText("");
      onImported?.();
      onClose();
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Import Failed", "We couldn't import those products. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
          accessibilityViewIsModal
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Import List
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
            Paste model numbers (e.g. CRS326-24S) — one per line, or separated by commas.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            numberOfLines={6}
            placeholder={"CRS804-4DDQ-hRM\nCCR2216-1G-12XS-2XQ"}
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 120,
              textAlignVertical: "top",
              marginBottom: 12,
            }}
          />
          {parsedInput.models.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {preview.matched.length} matched · {preview.unmatched.length} not
                found
              </Text>
              {preview.confidences
                .filter((c) => c.score > 0 && c.score <= 0.15)
                .slice(0, PREVIEW_LIMIT)
                .map((c) => {
                  const p = preview.matched.find((m) => m.id === c.productId);
                  return (
                    <Text key={`${c.input}-${c.productId}`} style={{ color: colors.warning, fontSize: 12, marginTop: 2 }}>
                      Fuzzy: “{c.input}” → {p?.modelNumber ?? c.productId} ({Math.round(c.confidence * 100)}% · score {c.score.toFixed(3)})
                    </Text>
                  );
                })}
              {preview.unmatched.slice(0, PREVIEW_LIMIT).map((m) => (
                <Text
                  key={m}
                  style={{ color: colors.error, fontSize: 12, marginTop: 2 }}
                >
                  Not found: {m}
                </Text>
              ))}
              {preview.unmatched.length > PREVIEW_LIMIT && (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  +{preview.unmatched.length - PREVIEW_LIMIT} more not found
                </Text>
              )}
              {alreadyTracked > 0 && (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {alreadyTracked} already in watchlist
                </Text>
              )}
            </View>
          )}
          <TouchableOpacity activeOpacity={0.85}
            onPress={handleImport}
            disabled={!canImport}
            style={{
              backgroundColor: canImport ? colors.primary : colors.border,
              opacity: !canImport ? 0.5 : 1,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            accessibilityLabel={`Import ${newProducts.length} product${newProducts.length === 1 ? "" : "s"}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canImport }}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                >
                  {newProducts.length > 0
                    ? `Import ${newProducts.length} product${newProducts.length === 1 ? "" : "s"}`
                    : "Nothing to import"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {discoveryNote && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
              {discoveryNote}
            </Text>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

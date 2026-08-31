import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { addToWatchlist } from "@/lib/storage";
import { matchModels, parseModelInput } from "@/lib/bulk-import";

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

  const preview = useMemo(() => matchModels(parseModelInput(text)), [text]);
  const newProducts = preview.matched.filter((p) => !trackedIds.has(p.id));
  const alreadyTracked = preview.matched.length - newProducts.length;
  const canImport = !importing && newProducts.length > 0;

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      for (const item of newProducts) {
        try {
          await addToWatchlist({
            ...item,
            addedAt: new Date().toISOString(),
            isWatched: true,
            listings: [],
          });
        } catch (e) {
          console.warn("[BulkImport] Skipping", item.modelNumber, e);
        }
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const unmatchedNote =
        preview.unmatched.length > 0
          ? `\n${preview.unmatched.length} not found in catalog.`
          : "";
      showAlert(
        "Import Complete",
        `${newProducts.length} added · ${alreadyTracked} already tracked.${unmatchedNote}`,
      );
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
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
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
              Import List 📋
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}>
            Paste model numbers — one per line, or separated by commas.
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
          {parseModelInput(text).length > 0 && (
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
            accessibilityLabel={`Import ${newProducts.length} products`}
            accessibilityRole="button"
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
        </View>
      </View>
    </Modal>
  );
}

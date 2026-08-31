import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAlert } from "@/lib/alert";
import { addToWatchlist, updateProductListings } from "@/lib/storage";
import { fetchParsedProduct } from "@/lib/server-product-parse";
import {
  customProductSlug,
  discoverListings,
} from "@/lib/listing-discovery";

interface Draft {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  modelNumber: "",
  brand: "",
  category: "",
  description: "",
};

function fieldStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 12,
  };
}

export function ManualAddSheet({
  visible,
  onClose,
  initialText,
  trackedIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
  trackedIds: Set<string>;
  onAdded?: () => void;
}) {
  const colors = useColors();
  const [raw, setRaw] = useState(initialText ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setRaw(initialText ?? "");
      setDraft(null);
    }
  }, [visible, initialText]);

  const reset = () => {
    setRaw(initialText ?? "");
    setDraft(null);
    setParsing(false);
    setAdding(false);
    setProgress(null);
    setAiFailed(false);
  };

  const handleClose = () => {
    if (parsing || adding) return;
    reset();
    onClose();
  };

  const handleParse = async () => {
    const text = raw.trim();
    if (!text || parsing) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setParsing(true);
    try {
      const parsed = await fetchParsedProduct(text);
      if (parsed) {
        setDraft(parsed);
        setAiFailed(false);
      } else {
        setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
        setAiFailed(true);
      }
    } catch {
      setDraft({ ...EMPTY_DRAFT, name: text.slice(0, 200) });
      setAiFailed(true);
    } finally {
      setParsing(false);
    }
  };

  const handleAdd = async () => {
    if (!draft || adding) return;
    const name = draft.name.trim();
    const modelNumber = draft.modelNumber.trim();
    if (!name || !modelNumber) return;

    const id = customProductSlug(modelNumber);
    if (trackedIds.has(id)) {
      showAlert(
        "Already Tracked",
        "That model number is already in your watchlist.",
      );
      return;
    }

    setAdding(true);
    try {
      await addToWatchlist({
        id,
        name,
        modelNumber,
        brand: draft.brand.trim(),
        category: draft.category.trim() || "Other",
        description: draft.description.trim(),
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: [],
      });
      setProgress("Searching distributors 0/…");
      const listings = await discoverListings(modelNumber, {
        productId: id,
        onProgress: (done, total) =>
          setProgress(`Searching distributors ${done}/${total}…`),
      });
      await updateProductListings(id, listings);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        "Product Added",
        listings.length > 0
          ? `Added "${name}" — found prices at ${listings.length} distributor${listings.length === 1 ? "" : "s"}.`
          : `Added "${name}". No distributor had it yet — we'll keep watching.`,
      );
      reset();
      onAdded?.();
      onClose();
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't add product", "We couldn't add this product. Please try again.");
    } finally {
      setAdding(false);
      setProgress(null);
    }
  };

  const canAdd =
    !!draft &&
    draft.name.trim().length > 0 &&
    draft.modelNumber.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
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
            maxHeight: "85%",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Add Custom Product ✨
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={handleClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          {draft === null ? (
            <>
              <Text
                style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}
              >
                Paste anything — a model number, product name, or a spec-sheet
                paragraph. AI cleans it up.
              </Text>
              <TextInput
                value={raw}
                onChangeText={setRaw}
                multiline
                autoFocus
                placeholder={
                  "e.g. MikroTik CRS326-24S+2Q+RM switch, 24x SFP+ 2x QSFP+, desktop rackmount"
                }
                placeholderTextColor={colors.muted}
                style={{
                  ...fieldStyle(colors),
                  minHeight: 110,
                  textAlignVertical: "top",
                }}
              />
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleParse}
                disabled={parsing || raw.trim().length === 0}
                style={{
                  backgroundColor:
                    raw.trim().length > 0 && !parsing
                      ? colors.primary
                      : colors.border,
                  opacity: parsing || raw.trim().length === 0 ? 0.5 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                accessibilityLabel="Clean up with AI"
                accessibilityRole="button"
                accessibilityState={{ disabled: parsing || raw.trim().length === 0 }}
              >
                {parsing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="wand.and.stars" size={18} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                      Clean up with AI
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView>
              {aiFailed && (
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  Couldn&apos;t reach the AI — please fill in the details
                  manually.
                </Text>
              )}
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}
              >
                Review and edit before adding.
              </Text>
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
                placeholder="Product name"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.modelNumber}
                onChangeText={(v) => setDraft({ ...draft, modelNumber: v })}
                placeholder="Model number"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.brand}
                onChangeText={(v) => setDraft({ ...draft, brand: v })}
                placeholder="Brand"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.category}
                onChangeText={(v) => setDraft({ ...draft, category: v })}
                placeholder="Category"
                placeholderTextColor={colors.muted}
                style={fieldStyle(colors)}
              />
              <TextInput
                value={draft.description}
                onChangeText={(v) => setDraft({ ...draft, description: v })}
                placeholder="Description"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  ...fieldStyle(colors),
                  minHeight: 70,
                  textAlignVertical: "top",
                }}
              />
              {progress && (
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  {progress}
                </Text>
              )}
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleAdd}
                disabled={!canAdd || adding}
                style={{
                  backgroundColor:
                    canAdd && !adding ? colors.primary : colors.border,
                  opacity: !canAdd || adding ? 0.5 : 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
                accessibilityLabel="Add and search distributors"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd || adding }}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol
                      name="plus.circle.fill"
                      size={18}
                      color="#fff"
                    />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                      Add & Search Distributors
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}
                onPress={() => setDraft(null)}
                disabled={parsing || adding}
                style={{ alignItems: "center", paddingVertical: 6, opacity: parsing || adding ? 0.5 : 1 }}
                accessibilityLabel="Back to paste"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Back to paste
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

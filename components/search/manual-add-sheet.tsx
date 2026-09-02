import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

const DISCOVER_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
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
  const [urlInput, setUrlInput] = useState("");
  const [urlParsing, setUrlParsing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const activeRef = useRef(true);

  const isUrlLike = (s: string) => /^https?:\/\/\S+/i.test(s.trim());

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setRaw(initialText ?? "");
      setUrlInput("");
      setDraft(null);
    }
  }, [visible, initialText]);

  const reset = () => {
    setRaw(initialText ?? "");
    setUrlInput("");
    setDraft(null);
    setParsing(false);
    setUrlParsing(false);
    setAdding(false);
    setProgress(null);
    setAiFailed(false);
  };

  const handleClose = () => {
    if (parsing || urlParsing || adding) return;
    reset();
    onClose();
  };

  const handleForceClose = () => {
    if (adding) return;
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

  const handleUrlParse = async () => {
    const text = urlInput.trim();
    if (!text || urlParsing || !isUrlLike(text)) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUrlParsing(true);
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
      setUrlParsing(false);
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
    let active = true;
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
      if (active && activeRef.current) setProgress("Searching distributors 0/…");
      let listings: Awaited<ReturnType<typeof discoverListings>>;
      try {
        listings = await withTimeout(
          discoverListings(modelNumber, {
            productId: id,
            onProgress: (done, total) => {
              if (active && activeRef.current) setProgress(`Searching distributors ${done}/${total}…`);
            },
          }),
          DISCOVER_TIMEOUT_MS,
        );
      } catch (e) {
        if (e instanceof Error && e.message === "timeout") {
          listings = [];
        } else {
          throw e;
        }
      }
      if (!active || !activeRef.current) return;
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
      if (!active || !activeRef.current) return;
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't add product", "We couldn't add this product. Please try again.");
    } finally {
      active = false;
      if (activeRef.current) {
        setAdding(false);
        setProgress(null);
      }
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>
                Paste distributor URL
              </Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://distributor.com/product/..."
                placeholderTextColor={colors.muted}
                style={{
                  ...fieldStyle(colors),
                  marginBottom: 12,
                }}
              />
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleUrlParse}
                disabled={urlParsing || !isUrlLike(urlInput)}
                style={{
                  backgroundColor:
                    isUrlLike(urlInput) && !urlParsing
                      ? colors.primary
                      : colors.border,
                  opacity: isUrlLike(urlInput) && !urlParsing ? 1 : 0.5,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                accessibilityLabel="Fetch from URL"
                accessibilityRole="button"
                accessibilityState={{ disabled: urlParsing || !isUrlLike(urlInput) }}
              >
                {urlParsing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="link" size={18} color="#fff" />
                    <Text
                      style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}
                    >
                      Fetch from URL
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
              {adding ? (
                <TouchableOpacity activeOpacity={0.7}
                  onPress={handleForceClose}
                  disabled={adding}
                  style={{ alignItems: "center", paddingVertical: 10, opacity: 0.5 }}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: true }}
                >
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

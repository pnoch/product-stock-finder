import { useEffect, useState } from "react";
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProductNote, saveProductNote } from "@/lib/product-notes";

export function NotesCard({ productId }: { productId: string }) {
  const colors = useColors();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    void getProductNote(productId).then(setNote);
  }, [productId]);

  const startEditing = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft(note);
    setSaveError("");
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    try {
      await saveProductNote(productId, trimmed);
    } catch {
      setSaveError("Couldn't save note. Please try again.");
      return;
    }
    setNote(trimmed);
    setEditing(false);
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: editing ? 10 : 0,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>My Note</Text>
        {!editing && (
          <TouchableOpacity activeOpacity={0.85} onPress={startEditing} hitSlop={8} accessibilityLabel="Edit note" accessibilityRole="button">
            <IconSymbol name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              if (saveError) setSaveError("");
            }}
            multiline
            autoFocus
            maxLength={500}
            placeholder="Private note (only visible on this device)…"
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 80,
              textAlignVertical: "top",
              marginBottom: 10,
            }}
          />
          {saveError ? (
            <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>
              {saveError}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity activeOpacity={0.7}
              onPress={() => {
                setSaveError("");
                setEditing(false);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              accessibilityLabel="Cancel editing"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleSave}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: colors.primary,
              }}
              accessibilityLabel="Save note"
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity activeOpacity={0.7} onPress={startEditing} accessibilityLabel="Edit note" accessibilityRole="button">
          {note ? (
            <Text
              style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}
            >
              {note}
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Add a private note…
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

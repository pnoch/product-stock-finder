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
import { showAlert } from "@/lib/alert";
import type { User } from "@/lib/_core/auth";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function DeleteAccountSheet({
  visible,
  onClose,
  colors,
  user,
  deleteStep,
  onDeleteStep,
  deleteConfirmText,
  onDeleteConfirmText,
  deleteTypedEmail,
  onDeleteTypedEmail,
  deleting,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  user: User | null | undefined;
  deleteStep: 1 | 2;
  onDeleteStep: (step: 1 | 2) => void;
  deleteConfirmText: string;
  onDeleteConfirmText: (value: string) => void;
  deleteTypedEmail: string;
  onDeleteTypedEmail: (value: string) => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.error, marginBottom: 8 }}>Delete Account & Data</Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>This will permanently delete your account and all associated data (GDPR Art.17). This cannot be undone.</Text>
            {deleteStep === 1 ? (
              <>
                <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Type DELETE to confirm:</Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={onDeleteConfirmText}
                  placeholder="DELETE"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                  accessibilityLabel="Type DELETE to confirm"
                />
                <TouchableOpacity activeOpacity={0.85} onPress={() => { if (deleteConfirmText === "DELETE") onDeleteStep(2); else showAlert("Confirm", 'Please type DELETE'); }} style={{ backgroundColor: colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 }} accessibilityLabel="Continue to email confirmation" accessibilityRole="button">
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center" }} accessibilityLabel="Cancel delete account" accessibilityRole="button">
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Type your email to confirm ({user?.email}):</Text>
                <TextInput
                  value={deleteTypedEmail}
                  onChangeText={onDeleteTypedEmail}
                  placeholder={user?.email ?? "email"}
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                  accessibilityLabel="Type email to confirm deletion"
                />
                <TouchableOpacity activeOpacity={0.85} onPress={onDelete} disabled={deleting} style={{ backgroundColor: colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12, opacity: deleting ? 0.5 : 1 }} accessibilityLabel="Confirm delete account" accessibilityRole="button">
                  {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Delete Account & Data</Text>}
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={() => onDeleteStep(1)} style={{ alignItems: "center", marginBottom: 12 }} accessibilityLabel="Back" accessibilityRole="button">
                  <Text style={{ color: colors.primary, fontSize: 14 }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center" }} accessibilityLabel="Cancel delete account step 2" accessibilityRole="button">
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ChangePasswordSheet({
  visible,
  onClose,
  colors,
  currentPw,
  onCurrentPw,
  newPw,
  onNewPw,
  confirmPw,
  onConfirmPw,
  changeError,
  changing,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  currentPw: string;
  onCurrentPw: (value: string) => void;
  newPw: string;
  onNewPw: (value: string) => void;
  confirmPw: string;
  onConfirmPw: (value: string) => void;
  changeError: string | null;
  changing: boolean;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Change Password</Text>
            <TextInput
              value={currentPw}
              onChangeText={onCurrentPw}
              placeholder="Current password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
              accessibilityLabel="Current password"
            />
            <TextInput
              value={newPw}
              onChangeText={onNewPw}
              placeholder="New password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
              accessibilityLabel="New password"
            />
            <TextInput
              value={confirmPw}
              onChangeText={onConfirmPw}
              placeholder="Confirm new password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              style={{ backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
              accessibilityLabel="Confirm new password"
            />
            {changeError && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>{changeError}</Text>}
            <TouchableOpacity activeOpacity={0.85} onPress={onSubmit} disabled={changing} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12, opacity: changing ? 0.5 : 1 }} accessibilityLabel="Submit change password" accessibilityRole="button">
              {changing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Update password</Text>}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ alignItems: "center" }} accessibilityLabel="Cancel change password" accessibilityRole="button">
              <Text style={{ color: colors.muted, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

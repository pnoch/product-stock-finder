import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS === "web") {
    showWebAlert(title, message, buttons);
    return;
  }
  Alert.alert(title, message, buttons);
}

function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (typeof window === "undefined") return;
  const text = message ?? title;
  const destructive = buttons?.find((b) => b.style === "destructive");
  if (destructive) {
    if (window.confirm(text)) destructive.onPress?.();
    return;
  }
  window.alert(text);
  buttons?.find((b) => b.style !== "cancel")?.onPress?.();
}

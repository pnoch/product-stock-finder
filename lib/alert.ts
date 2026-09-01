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
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }
  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }
  const cancel = buttons.find((b) => b.style === "cancel");
  const action =
    buttons.find((b) => b.style === "destructive") ??
    buttons.find((b) => b.style !== "cancel") ??
    buttons[0];
  if (window.confirm(text)) {
    action.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

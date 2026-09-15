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
  // Android's Alert supports at most 3 buttons; extras are silently dropped.
  // Fall back to a sequential choice so every option stays reachable.
  if (Platform.OS === "android" && buttons && buttons.length > 3) {
    showAndroidChoice(title, message, buttons);
    return;
  }
  Alert.alert(title, message, buttons);
}

function showAndroidChoice(
  title: string,
  message: string | undefined,
  buttons: AlertButton[],
): void {
  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b !== cancel);
  // Android shows at most 3 buttons. Reserve one slot for Cancel when present,
  // so the visible set never exceeds 3 (a 4th is silently dropped).
  const slots = cancel ? 2 : 3;
  const shown = actions.slice(0, slots);
  const remaining = actions.slice(slots);
  const options: AlertButton[] = [...shown];
  if (remaining.length > 0) {
    options.push({
      text: "More…",
      onPress: () => showAndroidChoice(title, message, [...remaining, ...(cancel ? [cancel] : [])]),
    });
  } else if (cancel) {
    options.push(cancel);
  }
  Alert.alert(title, message, options);
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

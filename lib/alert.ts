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
  const actions = buttons.filter((b) => b.style !== "cancel");

  // More than one real action: window.confirm can only express yes/no, which
  // silently made every action after the first unreachable (e.g. "Share as
  // Text" on web). Ask the user which one via a numbered prompt.
  if (actions.length > 1) {
    const list = actions
      .map((b, i) => `${i + 1}. ${b.text}`)
      .join("\n");
    const answer = window.prompt(`${text}\n\n${list}\n\nEnter a number:`, "1");
    if (answer === null) {
      cancel?.onPress?.();
      return;
    }
    const idx = Number.parseInt(answer, 10) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < actions.length) {
      actions[idx].onPress?.();
    } else {
      cancel?.onPress?.();
    }
    return;
  }

  const action = actions[0] ?? buttons[0];
  if (window.confirm(text)) {
    action.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

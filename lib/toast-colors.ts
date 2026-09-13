export type ToastType = "success" | "info" | "error";

export type ToastThemeColors = {
  foreground: string;
  background: string;
  primary: string;
  error: string;
  border: string;
};

// Success pairs a light background with dark text (like the watchlist undo
// bar); using white text on colors.foreground is unreadable in dark mode.
export function resolveToastColors(
  colors: ToastThemeColors,
  type: ToastType,
): { bg: string; text: string } {
  if (type === "success") {
    return { bg: colors.foreground, text: colors.background };
  }
  return {
    bg: type === "error" ? colors.error : colors.primary,
    text: "#fff",
  };
}

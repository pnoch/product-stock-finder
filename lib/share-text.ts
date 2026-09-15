import { Platform, Share } from "react-native";

export type ShareTextResult = "shared" | "copied" | "dismissed" | "failed";

// Cross-platform text share. react-native-web's Share.share rejects unless the
// browser exposes the Web Share API (desktop Chrome/Firefox do not), which made
// every "Share" button a silent no-op on web. Fall back to the clipboard and
// report the outcome so the caller can tell the user what happened.
export async function shareText(
  message: string,
  title?: string,
): Promise<ShareTextResult> {
  if (Platform.OS === "web") {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ text: message, title });
        return "shared";
      } catch (e) {
        // AbortError = user dismissed the sheet; anything else falls through.
        if ((e as { name?: string })?.name === "AbortError") return "dismissed";
      }
    }
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
        return "copied";
      }
    } catch {
      // fall through to failed
    }
    return "failed";
  }
  try {
    const result = await Share.share({ message, title });
    if ((result as unknown as { action?: string })?.action === Share.dismissedAction) {
      return "dismissed";
    }
    return "shared";
  } catch {
    return "failed";
  }
}

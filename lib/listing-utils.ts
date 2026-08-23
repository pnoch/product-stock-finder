import { Linking } from "react-native";
import { showAlert } from "@/lib/alert";

export async function openListingUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      showAlert("Cannot Open Link", "No app is available to open this URL.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    showAlert(
      "Error",
      "Could not open the distributor link. Please try again later.",
    );
  }
}

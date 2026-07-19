import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification Handler ─────────────────────────────────────────────────────
// Must be called at module level (outside any component) so it's set before
// any notification arrives, including when the app is in the foreground.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Android Channel Setup ────────────────────────────────────────────────────
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("stock-alerts", {
    name: "Stock Alerts",
    description: "Notifications when tracked products come back in stock",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1E6FD9",
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("price-alerts", {
    name: "Price Alerts",
    description: "Notifications when a product drops below your target price",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    sound: "default",
  });
}

// ─── Permission Request ───────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ─── Schedule a stock-available notification ──────────────────────────────────
export async function scheduleStockAlert(
  productName: string,
  distributorName: string,
  price: number,
  currency: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🟢 Back In Stock!",
        body: `${productName} is now available at ${distributorName} for ${currency} ${price.toFixed(2)}`,
        data: { type: "stock_alert", productName, distributorName },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Schedule a price-drop notification ──────────────────────────────────────
export async function schedulePriceAlert(
  productName: string,
  targetPrice: number,
  currency: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Price Alert Set",
        body: `You'll be notified when ${productName} drops below ${currency} ${targetPrice.toFixed(2)}`,
        data: { type: "price_alert", productName, targetPrice, currency },
        sound: "default",
      },
      trigger: null, // immediate confirmation notification
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Send a test notification ─────────────────────────────────────────────────
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Notifications Working!",
        body: "Stock Tracker Pro will alert you when prices drop or items come back in stock.",
        data: { type: "test" },
        sound: "default",
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

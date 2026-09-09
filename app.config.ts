// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

export interface AndroidIntentFilterData {
  scheme?: string;
  host?: string;
  pathPrefix?: string;
}

export interface AndroidIntentFilter {
  action: string;
  autoVerify?: boolean;
  data: AndroidIntentFilterData[];
  category: string[];
}

export function getWebLinkHost(webUrl?: string): string | undefined {
  if (!webUrl) return undefined;
  try {
    const host = new URL(webUrl).hostname.trim().toLowerCase();
    return host || undefined;
  } catch {
    return undefined;
  }
}

export function getAndroidIntentFilters(options: {
  scheme: string;
  webHost?: string;
}): AndroidIntentFilter[] {
  const filters: AndroidIntentFilter[] = [
    {
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: options.scheme, host: "*" }],
      category: ["BROWSABLE", "DEFAULT"],
    },
  ];
  const webHost = options.webHost?.trim().toLowerCase().replace(/\.$/, "");
  if (webHost) {
    filters.push({
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: "https", host: webHost }],
      category: ["BROWSABLE", "DEFAULT"],
    });
  }
  return filters;
}

export function getIosAssociatedDomains(webHost?: string): string[] {
  const host = webHost?.trim().toLowerCase().replace(/\.$/, "");
  return host ? [`applinks:${host}`] : [];
}

const bundleId = "com.app.stock_tracker_pro";

const env = {
  appName: "Product Stock Finder",
  appSlug: "product-stock-finder",
  scheme: "productstockfinder",
  iosBundleId: bundleId,
  androidPackage: bundleId,
  webUrl:
    process.env.EXPO_PUBLIC_WEB_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    "",
};

const webHost = getWebLinkHost(env.webUrl);

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "5.4.16",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    associatedDomains: getIosAssociatedDomains(webHost),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: getAndroidIntentFilters({
      scheme: env.scheme,
      webHost,
    }),
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
  },
};

export default config;

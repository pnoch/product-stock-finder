/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // React Native globals used by shared lib modules. `define` is a verbatim
  // text substitution, so the value must be a literal: substituting
  // `import.meta.env.DEV` emitted that expression into chunks where
  // `import.meta.env` is undefined, and the app crashed on boot with
  // "Cannot read properties of undefined (reading 'DEV')".
  define: {
    __DEV__: JSON.stringify(mode !== "production"),
    // Shared modules (lib/llm-discovery, lib/price-source, shared/src/trending)
    // read `process.env.EXPO_PUBLIC_*`; the desktop build only inlines VITE_*,
    // so without this bridge those modules see an empty API base and their
    // server-backed features silently fall back / fail.
    "process.env.EXPO_PUBLIC_API_BASE_URL":
      JSON.stringify(process.env.VITE_API_BASE_URL ?? ""),
    "process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY":
      JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY ?? ""),
    "process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL":
      JSON.stringify(process.env.VITE_OAUTH_PORTAL_URL ?? ""),
    "process.env.EXPO_PUBLIC_APP_ID":
      JSON.stringify(process.env.VITE_APP_ID ?? ""),
  },
  resolve: {
    alias: [
      {
        // shared/const.ts lives outside shared/src; resolve it first so
        // `@shared/const` doesn't become shared/src/const (missing).
        find: "@shared/const",
        replacement: path.resolve(__dirname, "../shared/const.ts"),
      },
      {
        find: "@shared",
        replacement: path.resolve(__dirname, "../shared/src"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, ".."),
      },
      {
        // Keep react-native out of the desktop bundle: shared lib modules
        // transitively import AsyncStorage; stub it.
        find: "@react-native-async-storage/async-storage",
        replacement: path.resolve(__dirname, "./src/lib/async-storage-stub.ts"),
      },
      {
        // Keep playwright out of the desktop bundle — same trick as the web
        // export: browser.web.ts is a stub with the same export surface.
        // Matches both "./browser" (from within lib/scrapers) and the
        // absolute path form.
        find: /^(?:\.\/browser|.*lib\/scrapers\/browser)$/,
        replacement: path.resolve(__dirname, "../lib/scrapers/browser.web.ts"),
      },
      {
        // Keep react-native out of the desktop bundle: shared lib modules
        // import Platform/Alert/Linking that desktop never renders.
        find: /^react-native$/,
        replacement: path.resolve(__dirname, "./src/lib/react-native-stub.ts"),
      },
      {
        // lib/_core/auth short-circuits on Platform.OS === "web" before
        // touching SecureStore, so a stub is safe on desktop.
        find: /^expo-secure-store$/,
        replacement: path.resolve(__dirname, "./src/lib/expo-secure-store-stub.ts"),
      },
      {
        // constants/oauth uses expo-linking only for native deep links.
        find: /^expo-linking$/,
        replacement: path.resolve(__dirname, "./src/lib/expo-linking-stub.ts"),
      },
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Never watch Rust build output: src-tauri/target holds hundreds of
    // thousands of files and exhausts the OS inotify limit (ENOSPC).
    watch: {
      ignored: ["**/src-tauri/target/**", "**/src-tauri/gen/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Split the eager vendor libraries so the app entry chunk is small and
        // stable vendors cache independently of app code. Dynamically-imported
        // node_modules (the Tauri updater) return undefined so Rollup keeps them
        // in their own lazy chunk instead of pulling them into a vendor bundle.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tauri-apps")) return undefined;
          if (id.includes("react-router")) return "vendor-router";
          if (
            id.includes("@tanstack") ||
            id.includes("@trpc") ||
            id.includes("superjson")
          )
            return "vendor-query";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler") ||
            id.includes("use-sync-external-store")
          )
            return "vendor-react";
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
    globals: true,
    // Vitest's 5s default is too tight when the desktop suite runs after the
    // root suite under `pnpm verify` load: a React state update can take >5s
    // and the test-level timeout (not RTL's) is what fires. Give headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
}));

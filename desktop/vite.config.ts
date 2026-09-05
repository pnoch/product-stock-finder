/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // React Native globals used by shared lib modules. import.meta.env.DEV
  // inlines to true/false per mode, matching Metro's __DEV__ semantics.
  define: {
    __DEV__: "import.meta.env.DEV",
  },
  resolve: {
    alias: [
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
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
    globals: true,
  },
});

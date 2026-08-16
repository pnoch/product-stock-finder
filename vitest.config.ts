import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    exclude: ["desktop/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
  },
});

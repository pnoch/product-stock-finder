import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared/src"),
      "@": path.resolve(__dirname, "."),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    exclude: ["desktop/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: !process.env.RUN_DB_TESTS,
  },
});

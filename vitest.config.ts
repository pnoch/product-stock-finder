import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Order matters: the more specific `@shared/const` (which lives at
      // shared/const.ts, not shared/src) must resolve before the bare prefix.
      "@shared/const": path.resolve(__dirname, "./shared/const.ts"),
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
    coverage: {
      // `coverage.all` scans the whole tree; without this it walks the Rust
      // build output (`desktop/src-tauri/target/**`, thousands of generated
      // files) and the report is unusable.
      exclude: [
        "desktop/**",
        "node_modules/**",
        "dist/**",
        "dist-web/**",
        "coverage/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
});

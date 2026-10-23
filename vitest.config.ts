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
      provider: "v8",
      // Only the shared app logic is gated. Screens/components are exercised by
      // the emulator/desktop smoke passes, and instrumenting them makes the
      // report noisy without protecting an invariant.
      include: ["lib/**", "hooks/**"],
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
      thresholds: {
        statements: 70,
        branches: 66,
        // Screen-level composition hooks are exercised by the emulator smoke
        // pass rather than unit tests; keep the gate just below the current
        // measured value so new logic still has to be tested.
        functions: 71.5,
        lines: 71,
      },
    },
  },
});

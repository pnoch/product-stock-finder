import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["desktop/**", "node_modules/**"],
  },
});

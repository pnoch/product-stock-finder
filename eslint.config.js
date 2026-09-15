// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "dist-web/*", ".expo/*", "node_modules/*"],
  },
  {
    // Node-side code (server, scripts) is not a React Native bundle: the Expo
    // rules for dynamic env access and browser globals don't apply, and these
    // files legitimately use `process.env[...]` / CommonJS globals.
    files: ["server/**/*.ts", "scripts/**/*.js", "shared/**/*.ts"],
    rules: {
      "expo/no-dynamic-env-var": "off",
    },
    languageOptions: {
      globals: { __dirname: "readonly", __filename: "readonly", process: "readonly" },
    },
  },
]);

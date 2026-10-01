import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `lib/legal-links` reads its env overrides at module load and `getApiBaseUrl`
// from `constants/oauth`, which pulls react-native — mock the latter and reload
// the module per case so each env combination is exercised.
const state = vi.hoisted(() => ({ apiBase: "" }));
vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: () => state.apiBase,
}));

const ENV_KEYS = [
  "EXPO_PUBLIC_PRIVACY_URL",
  "EXPO_PUBLIC_SUPPORT_EMAIL",
  "EXPO_PUBLIC_WEB_URL",
  "EXPO_PUBLIC_API_BASE_URL",
] as const;
type EnvKey = (typeof ENV_KEYS)[number];

const ORIGINAL: Record<EnvKey, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, process.env[k]]),
) as Record<EnvKey, string | undefined>;

async function load(
  env: Partial<Record<EnvKey, string>> = {},
  apiBase = "",
) {
  vi.resetModules();
  state.apiBase = apiBase;
  // Always start from a clean slate: an absent var (undefined) is distinct from
  // an empty-string value for the `??` fallback in `webBase`.
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  return import("../lib/legal-links");
}

beforeEach(() => {
  vi.resetModules();
  state.apiBase = "";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  vi.resetModules();
});

describe("getPrivacyPolicyUrl", () => {
  it("uses the privacy override verbatim", async () => {
    const { getPrivacyPolicyUrl } = await load({
      EXPO_PUBLIC_PRIVACY_URL: "https://p.example.com/x/",
      EXPO_PUBLIC_WEB_URL: "https://ignored.example.com",
    });
    // The override is trusted as-is — no trailing-slash normalization.
    expect(getPrivacyPolicyUrl()).toBe("https://p.example.com/x/");
  });

  it("prefers the web URL over the API URL and strips a trailing slash", async () => {
    const { getPrivacyPolicyUrl } = await load({
      EXPO_PUBLIC_WEB_URL: "https://web.example.com/",
      EXPO_PUBLIC_API_BASE_URL: "https://api.example.com/",
    });
    expect(getPrivacyPolicyUrl()).toBe("https://web.example.com/privacy");
  });

  it("falls back to the API URL when the web URL is unset", async () => {
    const { getPrivacyPolicyUrl } = await load({
      EXPO_PUBLIC_API_BASE_URL: "https://api.example.com/",
    });
    expect(getPrivacyPolicyUrl()).toBe("https://api.example.com/privacy");
  });

  it("falls back to the resolved API base when neither env URL is set", async () => {
    const { getPrivacyPolicyUrl } = await load({}, "https://api-base.example.com/");
    expect(getPrivacyPolicyUrl()).toBe(
      "https://api-base.example.com/privacy",
    );
  });

  it("returns an empty string when nothing is configured", async () => {
    const { getPrivacyPolicyUrl } = await load({}, "");
    expect(getPrivacyPolicyUrl()).toBe("");
  });
});

describe("getSupportEmail / getSupportMailtoUrl", () => {
  it("returns the default support address when unset", async () => {
    const { getSupportEmail, getSupportMailtoUrl } = await load();
    expect(getSupportEmail()).toBe("support@productstockfinder.savvylife.icu");
    expect(getSupportMailtoUrl()).toBe(
      "mailto:support@productstockfinder.savvylife.icu",
    );
  });

  it("uses the configured support address", async () => {
    const { getSupportEmail, getSupportMailtoUrl } = await load({
      EXPO_PUBLIC_SUPPORT_EMAIL: "help@example.com",
    });
    expect(getSupportEmail()).toBe("help@example.com");
    expect(getSupportMailtoUrl()).toBe("mailto:help@example.com");
  });

  it("treats an empty override as unset", async () => {
    // `||`, not `??`: an empty override would otherwise produce a bare
    // `mailto:` that opens the mail client with a blank recipient.
    const { getSupportEmail, getSupportMailtoUrl } = await load({
      EXPO_PUBLIC_SUPPORT_EMAIL: "",
    });
    expect(getSupportEmail()).toBe("support@productstockfinder.savvylife.icu");
    expect(getSupportMailtoUrl()).toBe(
      "mailto:support@productstockfinder.savvylife.icu",
    );
  });
});

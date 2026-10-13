// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { isMarketplaceUrlAllowed } from "@/lib/marketplace/connections";

vi.mock("react-native-webview", () => ({ WebView: () => null }));
vi.mock("react-native", () => ({
  Modal: () => null,
  View: () => null,
  Text: () => null,
  Pressable: () => null,
  Platform: { OS: "ios" },
}));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({}) }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("expo-linking", () => ({ openURL: vi.fn(async () => {}) }));

import { navigationAllowed } from "@/components/session-assist-modal";

const facebookPolicy = (url: string) => isMarketplaceUrlAllowed("facebook", url);
const shopeePolicy = (url: string) => isMarketplaceUrlAllowed("shopee", url);
const lazadaPolicy = (url: string) => isMarketplaceUrlAllowed("lazada", url);

describe("marketplace navigation policy", () => {
  it("accepts only the configured HTTPS marketplace hosts", () => {
    expect(facebookPolicy("https://www.facebook.com/marketplace/")).toBe(true);
    expect(facebookPolicy("https://web.facebook.com/")).toBe(true);
    expect(facebookPolicy("https://m.facebook.com/")).toBe(true);
    expect(shopeePolicy("https://shopee.co.th/")).toBe(true);
    expect(lazadaPolicy("https://www.lazada.co.th/")).toBe(true);
  });

  it("rejects lookalike hosts", () => {
    expect(facebookPolicy("https://www.facebook.com.evil.com/")).toBe(false);
    expect(facebookPolicy("https://evilfacebook.com/")).toBe(false);
    expect(facebookPolicy("https://facebook.com.evil.com/")).toBe(false);
    expect(facebookPolicy("https://wwwx.facebook.com/")).toBe(false);
    expect(facebookPolicy("https://facebook.com/")).toBe(false);
    expect(facebookPolicy("https://www.facebook.com.co/")).toBe(false);
  });

  it("rejects cross-site hosts", () => {
    expect(shopeePolicy("https://www.facebook.com/")).toBe(false);
    expect(facebookPolicy("https://shopee.co.th/")).toBe(false);
    expect(lazadaPolicy("https://lazada.co.th/")).toBe(false);
  });

  it("rejects HTTP, custom ports, and embedded credentials", () => {
    expect(facebookPolicy("http://www.facebook.com/")).toBe(false);
    expect(facebookPolicy("https://www.facebook.com:8443/")).toBe(false);
    expect(facebookPolicy("https://user:pass@www.facebook.com/")).toBe(false);
    expect(facebookPolicy("https://user@www.facebook.com/")).toBe(false);
  });

  it("rejects malformed destinations", () => {
    expect(facebookPolicy("not a url")).toBe(false);
    expect(facebookPolicy("")).toBe(false);
    expect(facebookPolicy("javascript:alert(1)")).toBe(false);
  });
});

describe("navigationAllowed", () => {
  it("allows the internal about:blank document even with a policy", () => {
    expect(navigationAllowed("about:blank", facebookPolicy)).toBe(true);
  });

  it("delegates web destinations to the supplied policy", () => {
    expect(navigationAllowed("https://www.facebook.com/marketplace/", facebookPolicy)).toBe(true);
    expect(navigationAllowed("https://example.com/", facebookPolicy)).toBe(false);
  });

  it("keeps distributor behavior when no policy is supplied", () => {
    expect(navigationAllowed("https://www.pbtech.co.nz/x")).toBe(true);
    expect(navigationAllowed("http://www.pbtech.co.nz/x")).toBe(true);
    expect(navigationAllowed("about:blank")).toBe(true);
    expect(navigationAllowed("intent://scan")).toBe(false);
    expect(navigationAllowed("javascript:alert(1)")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "../server/web-push";

describe("isAllowedPushEndpoint (SSRF guard)", () => {
  it("allows the real push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("rejects internal / metadata / arbitrary hosts", () => {
    for (const endpoint of [
      "https://127.0.0.1:8443/",
      "https://169.254.169.254/latest/meta-data/",
      "https://localhost/",
      "https://internal.corp/",
      "https://push.example.com/abc",
      "https://evil.com/fcm.googleapis.com",
      "http://fcm.googleapis.com/fcm/send/abc",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  it("rejects malformed endpoints", () => {
    expect(isAllowedPushEndpoint("")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
  });
});

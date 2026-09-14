import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isEmailConfigured, sendEmail } from "../server/email";

describe("email delivery", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reports unconfigured without the API key and from address", () => {
    expect(isEmailConfigured()).toBe(false);
  });

  it("skips sending and returns false when unconfigured", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const ok = await sendEmail({
      to: "a@b.com",
      subject: "s",
      html: "<p>x</p>",
      text: "x",
    });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Resend with bearer auth when configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    expect(isEmailConfigured()).toBe(true);
    const ok = await sendEmail({
      to: "a@b.com",
      subject: "Reset",
      html: "<p>x</p>",
      text: "x",
    });
    expect(ok).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("a@b.com");
    expect(body.from).toBe("no-reply@example.com");
  });

  it("returns false on a non-ok provider response", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "no-reply@example.com";
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 422, text: async () => "bad" }) as Response) as unknown as typeof fetch;
    const ok = await sendEmail({ to: "a@b.com", subject: "s", html: "h", text: "t" });
    expect(ok).toBe(false);
  });
});

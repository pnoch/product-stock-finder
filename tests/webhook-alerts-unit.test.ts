import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildWebhookPayload,
  buildWebhookText,
  classifyWebhookUrl,
  postWebhook,
  sendTestWebhook,
} from "../server/notifications/webhook-alerts";

afterEach(() => vi.unstubAllGlobals());

describe("classifyWebhookUrl", () => {
  it("accepts Discord hosts and subdomains", () => {
    expect(classifyWebhookUrl("https://discord.com/api/webhooks/1/x")?.provider).toBe("discord");
    expect(classifyWebhookUrl("https://discordapp.com/api/webhooks/1/x")?.provider).toBe("discord");
    expect(classifyWebhookUrl("https://ptb.discord.com/api/webhooks/1/x")?.provider).toBe("discord");
  });

  it("accepts the Slack incoming-webhook host", () => {
    expect(classifyWebhookUrl("https://hooks.slack.com/services/T/B/x")?.provider).toBe("slack");
  });

  it("rejects http, unknown hosts, and host-spoofs", () => {
    expect(classifyWebhookUrl("http://discord.com/api/webhooks/1/x")).toBeNull();
    expect(classifyWebhookUrl("https://evil.com/x")).toBeNull();
    expect(classifyWebhookUrl("https://discord.com.evil.com/x")).toBeNull();
    expect(classifyWebhookUrl("https://xdiscord.com/x")).toBeNull();
    expect(classifyWebhookUrl("not a url")).toBeNull();
    expect(classifyWebhookUrl("")).toBeNull();
  });

  it("rejects userinfo spoofs and trailing-dot hosts, accepts mixed case", () => {
    expect(classifyWebhookUrl("https://discord.com@evil.com/x")).toBeNull();
    expect(classifyWebhookUrl("https://discord.com./api/webhooks/1/x")).toBeNull();
    expect(classifyWebhookUrl("https://DISCORD.COM/api/webhooks/1/x")?.provider).toBe("discord");
  });
});

describe("buildWebhookPayload", () => {
  it("uses `content` + no-parse mentions for Discord", () => {
    expect(buildWebhookPayload("discord", "hi")).toEqual({
      content: "hi",
      allowed_mentions: { parse: [] },
    });
  });

  it("uses `text` for Slack", () => {
    expect(buildWebhookPayload("slack", "hi")).toEqual({ text: "hi" });
  });

  it("neutralizes mention syntax", () => {
    const discord = buildWebhookPayload("discord", "@everyone <@123> <!channel>") as {
      content: string;
    };
    expect(discord.content).not.toContain("@everyone");
    expect(discord.content).not.toContain("<@123>");
    expect(discord.content).not.toContain("<!channel>");
    expect(discord.content).toContain("[mention]");
  });

  it("neutralizes Slack mention formats", () => {
    const slack = buildWebhookPayload("slack", "<@U012AB3CD> <@U123|name> <!subteam^S123> @here @channel") as {
      text: string;
    };
    expect(slack.text).not.toContain("<@");
    expect(slack.text).not.toContain("<!");
    expect(slack.text).not.toContain("@here");
    expect(slack.text).not.toContain("@channel");
    expect(slack.text).toContain("[mention]");
    expect(slack.text).toContain("[subteam^S123]");
  });
});

describe("buildWebhookText", () => {
  it("includes the product link and the manage line", () => {
    const text = buildWebhookText({
      title: "Drop",
      body: "CRS804 is $420",
      productUrl: "https://app.example.com/product/p1",
    });
    expect(text).toContain("https://app.example.com/product/p1");
    expect(text).toContain("Manage alerts");
  });

  it("omits the product link when null", () => {
    const text = buildWebhookText({ title: "T", body: "B", productUrl: null });
    expect(text).not.toContain("https://");
  });
});

describe("postWebhook", () => {
  it("returns true on a 2xx and sends the expected request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await postWebhook("slack", "https://hooks.slack.com/services/T/B/x", "hi")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/x",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hi" }),
        redirect: "error",
      }),
    );
  });

  it("returns false on a non-2xx or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    expect(await postWebhook("discord", "https://discord.com/api/webhooks/1/x", "hi")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await postWebhook("discord", "https://discord.com/api/webhooks/1/x", "hi")).toBe(false);
  });
});

describe("sendTestWebhook", () => {
  it("rejects an unallowlisted URL without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendTestWebhook("https://evil.com/x");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid Discord or Slack/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports success on 2xx and failure on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect((await sendTestWebhook("https://discord.com/api/webhooks/1/x")).ok).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const failed = await sendTestWebhook("https://discord.com/api/webhooks/1/x");
    expect(failed.ok).toBe(false);
    expect(failed.error).toBeTruthy();
  });
});

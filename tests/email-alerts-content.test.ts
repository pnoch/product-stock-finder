import { describe, expect, it } from "vitest";
import { buildAlertEmail } from "../server/notifications/email-alerts";

describe("buildAlertEmail", () => {
  it("includes title, body, product link and unsubscribe link", () => {
    const msg = buildAlertEmail({
      title: "💸 Price Drop Alert!",
      body: "CRS804 is now $420",
      productUrl: "https://app.example.com/product/p1",
      unsubscribeUrl: "https://api.example.com/api/email/unsubscribe?u=1&t=abc",
    });
    expect(msg.subject).toBe("💸 Price Drop Alert!");
    expect(msg.text).toContain("CRS804 is now $420");
    expect(msg.text).toContain("https://app.example.com/product/p1");
    expect(msg.text).toContain("unsubscribe?u=1&t=abc");
    expect(msg.html).toContain("https://app.example.com/product/p1");
    expect(msg.html).toContain("unsubscribe?u=1&t=abc");
  });

  it("omits the product link when there is none", () => {
    const msg = buildAlertEmail({
      title: "T",
      body: "B",
      productUrl: null,
      unsubscribeUrl: "https://api.example.com/api/email/unsubscribe?u=1&t=abc",
    });
    expect(msg.text).not.toContain("View:");
    expect(msg.html).not.toContain("View product");
  });

  it("escapes HTML in the title and body", () => {
    const msg = buildAlertEmail({
      title: "<script>",
      body: "<b>x</b>",
      productUrl: null,
      unsubscribeUrl: "u",
    });
    expect(msg.html).not.toContain("<script>");
    expect(msg.html).toContain("&lt;script&gt;");
  });
});

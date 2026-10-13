import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  buildSnapshotJS,
  parseSnapshotMessage,
  SNAPSHOT_MESSAGE_MARKER,
  MAX_SNAPSHOT_CARDS,
  MAX_SNAPSHOT_HTML_CHARS,
  STORAGE_CLEARED_SENTINEL,
  type MarketplacePageSnapshot,
} from "../lib/scrapers/webview-host";
import { extractFbCards } from "../lib/marketplace/fb-search";

const nodeRequire = createRequire(import.meta.url);

interface JsdomWindow {
  ReactNativeWebView?: { postMessage: (data: string) => void };
  eval: (code: string) => unknown;
  document: Document;
}

function envelope(payload: Record<string, unknown>): string {
  return SNAPSHOT_MESSAGE_MARKER + JSON.stringify(payload);
}

const SEARCH_URL = "https://www.facebook.com/marketplace/search/?query=mac%20pro";

const ADVERSARIAL = `
<html><body>
  <div class="list">
    <div class="card">
      <a href="/marketplace/item/111111111111111/">Mac Pro 2019 Xeon</a>
      <span>"formatted_price":{"text":"฿45,000"}</span>
      <span>Bangkok</span>
    </div>
    <div class="card">
      <a href="/marketplace/item/222222222222222/">Ubiquiti UniFi Switch</a>
      <span>"formatted_price":{"text":"฿12,500"}</span>
      <span>Nonthaburi</span>
    </div>
    <div class="card">
      <a href="/marketplace/item/333333333333333/">Ambiguous A</a>
      <a href="/marketplace/item/444444444444444/">Ambiguous B</a>
      <span>"formatted_price":{"text":"฿9,999"}</span>
    </div>
  </div>
</body></html>`;

function runSnapshotScript(
  html: string,
  url = SEARCH_URL,
): Promise<MarketplacePageSnapshot> {
  const { JSDOM } = nodeRequire("jsdom") as {
    JSDOM: new (
      markup: string,
      options: Record<string, unknown>,
    ) => { window: JsdomWindow };
  };
  return new Promise<MarketplacePageSnapshot>((resolve, reject) => {
    const dom = new JSDOM(html, {
      url,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const win = dom.window;
    win.ReactNativeWebView = {
      postMessage: (data: string) => {
        const snapshot = parseSnapshotMessage(data);
        if (snapshot) resolve(snapshot);
      },
    };
    try {
      win.eval(buildSnapshotJS({ timeoutMs: 100, settleMs: 0 }));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

describe("parseSnapshotMessage", () => {
  it("rejects the clear-storage sentinel and raw HTML", () => {
    expect(parseSnapshotMessage(STORAGE_CLEARED_SENTINEL)).toBeNull();
    expect(parseSnapshotMessage("<html><body>plain</body></html>")).toBeNull();
  });

  it("rejects malformed JSON and non-object payloads", () => {
    expect(parseSnapshotMessage(SNAPSHOT_MESSAGE_MARKER + "{not json")).toBeNull();
    expect(parseSnapshotMessage(envelope({ url: 1, html: "x" }))).toBeNull();
  });

  it("accepts and normalizes a well-formed snapshot", () => {
    const snapshot = parseSnapshotMessage(
      envelope({
        url: SEARCH_URL,
        html: "<html></html>",
        cards: [
          {
            itemUrl: "https://www.facebook.com/marketplace/item/111/",
            title: "Mac Pro",
            priceText: "฿45,000",
            location: "Bangkok",
          },
        ],
        scope: { area: "San Francisco", radiusKm: 40 },
        emptyMessage: "",
        loginVisible: true,
      }),
    );
    expect(snapshot).toEqual({
      url: SEARCH_URL,
      html: "<html></html>",
      cards: [
        {
          itemUrl: "https://www.facebook.com/marketplace/item/111/",
          title: "Mac Pro",
          priceText: "฿45,000",
          location: "Bangkok",
        },
      ],
      scope: { area: "San Francisco", radiusKm: 40 },
      emptyMessage: null,
      loginVisible: true,
    });
  });

  it("bounds the HTML, caps cards, and drops cards without an item URL", () => {
    const cards: Record<string, unknown>[] = Array.from(
      { length: MAX_SNAPSHOT_CARDS + 10 },
      (_, i) => ({
        itemUrl: `https://www.facebook.com/marketplace/item/${i + 1}/`,
        title: `Item ${i}`,
      }),
    );
    cards.push({ itemUrl: "" });
    const snapshot = parseSnapshotMessage(
      envelope({
        url: SEARCH_URL,
        html: "x".repeat(MAX_SNAPSHOT_HTML_CHARS + 5000),
        cards,
        scope: { area: null, radiusKm: -5 },
        emptyMessage: null,
        loginVisible: false,
      }),
    );
    expect(snapshot).not.toBeNull();
    expect(snapshot!.html).toHaveLength(MAX_SNAPSHOT_HTML_CHARS);
    expect(snapshot!.cards).toHaveLength(MAX_SNAPSHOT_CARDS);
    expect(snapshot!.scope).toEqual({ area: null, radiusKm: null });
  });

  it("treats an oversized payload as unreadable", () => {
    const huge = SNAPSHOT_MESSAGE_MARKER + "{" + "x".repeat(MAX_SNAPSHOT_HTML_CHARS + 300_000);
    expect(parseSnapshotMessage(huge)).toBeNull();
  });
});

describe("buildSnapshotJS", () => {
  it("emits a bounded JSON snapshot message distinct from the clear sentinel", () => {
    const source = buildSnapshotJS({ timeoutMs: 1000, settleMs: 300 });
    expect(source).toContain(SNAPSHOT_MESSAGE_MARKER);
    expect(source).toContain("JSON.stringify");
    expect(source).not.toContain(STORAGE_CLEARED_SENTINEL);
    expect(source).toContain(String(MAX_SNAPSHOT_CARDS));
  });

  it("associates each link with its own card and rejects ambiguous containers", async () => {
    const snapshot = await runSnapshotScript(ADVERSARIAL);
    expect(snapshot.cards).toHaveLength(2);
    expect(snapshot.cards[0]).toMatchObject({
      title: "Mac Pro 2019 Xeon",
      priceText: "฿45,000",
      location: "Bangkok",
    });
    expect(snapshot.cards[1]).toMatchObject({
      title: "Ubiquiti UniFi Switch",
      priceText: "฿12,500",
      location: "Nonthaburi",
    });
    expect(snapshot.cards.some((card) => card.title?.includes("Ambiguous"))).toBe(false);
  });

  it("matches the HTML extractor used by fb-search on the same page", async () => {
    const snapshot = await runSnapshotScript(ADVERSARIAL);
    expect(snapshot.cards).toEqual(extractFbCards(ADVERSARIAL));
  });

  it("reports a blocking login dialog but not a bare header Login link", async () => {
    const dialog = await runSnapshotScript(
      `<html><body><div role="dialog"><input type="password"><div>Log in</div><div>Forgotten password?</div></div></body></html>`,
    );
    expect(dialog.loginVisible).toBe(true);

    const headerOnly = await runSnapshotScript(
      `<html><body><header><a href="/login">Log in</a></header><div>Marketplace</div></body></html>`,
    );
    expect(headerOnly.loginVisible).toBe(false);
  });

  it("reports a no-listings message only on a recognized search page", async () => {
    const empty = await runSnapshotScript(
      `<html><body><div>No listings found</div><div>Try a different search</div></body></html>`,
      SEARCH_URL,
    );
    expect(empty.emptyMessage).toMatch(/no listings found/i);

    const notSearch = await runSnapshotScript(
      `<html><body><div>No listings found</div></body></html>`,
      "https://www.facebook.com/marketplace/",
    );
    expect(notSearch.emptyMessage).toBeNull();
  });
});

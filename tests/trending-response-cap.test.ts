import { describe, expect, it } from "vitest";
import { readCapped } from "../server/routers/trending";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= chunks.length) {
        c.close();
        return;
      }
      c.enqueue(enc.encode(chunks[i++]!));
    },
  });
}

describe("trending response cap", () => {
  it("stops reading a feed far past the cap instead of buffering it", async () => {
    // A hostile/looping feed used to be read whole via res.text(), which could
    // exhaust the process inside the abort window.
    const chunks = Array.from({ length: 40 }, () => "x".repeat(100_000));
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (pulls >= chunks.length) {
          c.close();
          return;
        }
        c.enqueue(new TextEncoder().encode(chunks[pulls++]!));
      },
    });
    const result = await readCapped({ body } as unknown as Response, 1_000_000);
    expect(result).toBeNull();
    expect(pulls).toBeGreaterThan(0);
    expect(pulls).toBeLessThan(chunks.length);
  });

  it("returns a body within the cap", async () => {
    const res = { body: streamOf(["<rss>", "<item>x</item>", "</rss>"]) } as unknown as Response;
    expect(await readCapped(res, 1000)).toBe("<rss><item>x</item></rss>");
  });
});

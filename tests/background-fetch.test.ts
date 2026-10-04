import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  backgroundFetch,
  BackgroundFetchTimeoutError,
} from "../lib/background-fetch";

// A minimal XMLHttpRequest double: the test drives the terminal callback.
class FakeXhr {
  static last: FakeXhr | null = null;
  static sendThrows = false;
  static sendThrowsValue: unknown = new Error("send failed");
  open = vi.fn();
  send = vi.fn(() => {
    if (FakeXhr.sendThrows) throw FakeXhr.sendThrowsValue;
  });
  setRequestHeader = vi.fn((name: string) => {
    if (name === "User-Agent") throw new Error("forbidden header");
  });
  timeout = 0;
  status = 200;
  response: unknown = "<html>ok</html>";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
}

describe("backgroundFetch", () => {
  beforeEach(() => {
    FakeXhr.last = null;
    FakeXhr.sendThrows = false;
    FakeXhr.sendThrowsValue = new Error("send failed");
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the body and status on load", async () => {
    const p = backgroundFetch("https://x.test/a", 4000);
    const xhr = FakeXhr.last!;
    expect(xhr.timeout).toBe(4000);
    xhr.status = 201;
    xhr.onload!();
    await expect(p).resolves.toEqual({ html: "<html>ok</html>", status: 201 });
  });

  it("skips a header the platform rejects", async () => {
    const p = backgroundFetch("https://x.test/a", 1000, {
      "User-Agent": "X",
      Accept: "text/html",
    });
    const xhr = FakeXhr.last!;
    // The rejected header must not abort the request.
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("Accept", "text/html");
    xhr.onload!();
    await expect(p).resolves.toBeDefined();
  });

  it("rejects with a typed timeout error", async () => {
    const p = backgroundFetch("https://x.test/a", 1000);
    FakeXhr.last!.ontimeout!();
    await expect(p).rejects.toBeInstanceOf(BackgroundFetchTimeoutError);
  });

  it("rejects on a network error and on abort", async () => {
    const netErr = backgroundFetch("https://x.test/a", 1000);
    FakeXhr.last!.onerror!();
    await expect(netErr).rejects.toThrow(/Network request failed/);

    const aborted = backgroundFetch("https://x.test/b", 1000);
    FakeXhr.last!.onabort!();
    await expect(aborted).rejects.toThrow(/Aborted/);
  });

  it("rejects when send() throws synchronously", async () => {
    FakeXhr.sendThrows = true;
    await expect(backgroundFetch("https://x.test/a", 1000)).rejects.toThrow(
      /send failed/,
    );
  });

  it("resolves with an empty body when the response is null", async () => {
    const p = backgroundFetch("https://x.test/a", 1000);
    const xhr = FakeXhr.last!;
    xhr.response = null;
    xhr.onload!();
    await expect(p).resolves.toEqual({ html: "", status: 200 });
  });

  it("ignores every callback after the first settles it", async () => {
    const p = backgroundFetch("https://x.test/a", 1000);
    const xhr = FakeXhr.last!;
    xhr.onload!();
    // All of these hit the `if (settled) return` guards.
    xhr.onload!();
    xhr.ontimeout!();
    xhr.onabort!();
    await expect(p).resolves.toEqual({ html: "<html>ok</html>", status: 200 });
  });

  it("wraps a non-Error throw from send()", async () => {
    FakeXhr.sendThrows = true;
    FakeXhr.sendThrowsValue = "boom";
    await expect(backgroundFetch("https://x.test/a", 1000)).rejects.toThrow("boom");
  });

  it("keeps the first outcome when a second callback fires late", async () => {
    // The `settled` guard is defensive and not externally observable (rejecting
    // an already-resolved promise is a no-op), so this only pins the outcome.
    const p = backgroundFetch("https://x.test/a", 1000);
    const xhr = FakeXhr.last!;
    xhr.onload!();
    xhr.onerror!();
    await expect(p).resolves.toEqual({ html: "<html>ok</html>", status: 200 });
  });
});

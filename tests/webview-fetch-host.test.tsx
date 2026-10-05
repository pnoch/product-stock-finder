// @vitest-environment jsdom
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

const wv = vi.hoisted(() => ({ list: [] as any[] }));
vi.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    wv.list.push(props);
    return React.createElement("div");
  },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...rest }: any) =>
      React.createElement("div", rest, children),
  };
});

import { WebViewFetchHost } from "@/components/webview-fetch-host";
import { getWebViewHost } from "@/lib/scrapers/webview-host";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

// Latest props for a given source uri: the component re-renders per state change
// and the mock runs on every render, so scan from the end.
function wvFor(uri: string) {
  return [...wv.list].reverse().find((p) => p.source?.uri === uri);
}

describe("WebViewFetchHost", () => {
  beforeEach(() => {
    wv.list = [];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("registers a host and resolves the posted HTML", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost();
    expect(host).not.toBeNull();

    const pending = host!.load("https://example.com", { waitForSelector: ".price" });
    await act(async () => {});
    const props = wvFor("https://example.com");
    expect(props).toBeTruthy();
    expect(String(props.injectedJavaScript)).toContain(".price");

    act(() => {
      props.onMessage({ nativeEvent: { data: "<html>x</html>" } });
    });
    await expect(pending).resolves.toBe("<html>x</html>");
  });

  it("rejects when the WebView errors", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://x.test");
    pending.catch(() => {});
    await act(async () => {});
    act(() => {
      wvFor("https://x.test").onError({ nativeEvent: { description: "boom" } });
    });
    await expect(pending).rejects.toThrow("boom");
  });

  it("renders two at once and starts the next when a slot frees", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test");
    const b = host.load("https://b.test");
    await act(async () => {});
    expect(wvFor("https://a.test")).toBeTruthy();
    expect(wvFor("https://b.test")).toBeTruthy();

    // Third request waits: both pool slots are busy.
    const c = host.load("https://c.test");
    await act(async () => {});
    expect(wvFor("https://c.test")).toBeFalsy();

    act(() => {
      wvFor("https://a.test").onMessage({ nativeEvent: { data: "A" } });
    });
    await expect(a).resolves.toBe("A");
    await act(async () => {});
    expect(wvFor("https://c.test")).toBeTruthy();

    act(() => {
      wvFor("https://b.test").onMessage({ nativeEvent: { data: "B" } });
    });
    act(() => {
      wvFor("https://c.test").onMessage({ nativeEvent: { data: "C" } });
    });
    await expect(b).resolves.toBe("B");
    await expect(c).resolves.toBe("C");
  });

  it("rejects queued and active work when unmounted", async () => {
    const { unmount } = render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test");
    const b = host.load("https://b.test");
    const c = host.load("https://c.test");
    a.catch(() => {});
    b.catch(() => {});
    c.catch(() => {});
    await act(async () => {});
    unmount();
    await expect(a).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(b).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(c).rejects.toBeInstanceOf(BrowserUnavailableError);
    expect(getWebViewHost()).toBeNull();
  });

  it("rejects a request that exceeds its timeout", async () => {
    vi.useFakeTimers();
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://slow.test", {
      timeoutMs: 1000,
    });
    pending.catch(() => {});
    await act(async () => {});
    expect(wvFor("https://slow.test")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await expect(pending).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(pending).rejects.toThrow(/timed out/i);
  });

  it("ignores a stale event from a request whose slot was reused", async () => {
    vi.useFakeTimers();
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test", { timeoutMs: 1000 });
    const b = host.load("https://b.test");
    a.catch(() => {});
    b.catch(() => {});
    await act(async () => {});
    const aProps = wvFor("https://a.test");
    expect(aProps).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});
    await expect(a).rejects.toBeInstanceOf(BrowserUnavailableError);

    // C reuses A's freed slot; A's late handler must not settle C.
    const c = host.load("https://c.test");
    await act(async () => {});
    act(() => {
      aProps.onMessage({ nativeEvent: { data: "STALE-A" } });
    });
    await act(async () => {});

    let cSettled = false;
    c.then(
      () => {
        cSettled = true;
      },
      () => {
        cSettled = true;
      },
    );
    await act(async () => {});
    expect(cSettled).toBe(false);

    act(() => {
      wvFor("https://c.test").onMessage({ nativeEvent: { data: "C" } });
    });
    await expect(c).resolves.toBe("C");
    act(() => {
      wvFor("https://b.test").onMessage({ nativeEvent: { data: "B" } });
    });
    await expect(b).resolves.toBe("B");
  });

  it("allows http(s) navigations and blocks non-web schemes", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://nav.test");
    pending.catch(() => {});
    await act(async () => {});

    const shouldLoad = wvFor("https://nav.test").onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: "https://nav.test/page" })).toBe(true);
    expect(shouldLoad({ url: "http://nav.test" })).toBe(true);
    expect(shouldLoad({ url: "about:blank" })).toBe(true);
    expect(shouldLoad({ url: "intent://scan/#Intent;scheme=zxing;end" })).toBe(false);
    expect(shouldLoad({ url: "market://details?id=x" })).toBe(false);
    expect(shouldLoad({ url: "tel:+123456" })).toBe(false);
  });

  it("clears DOM storage via a clear job", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const cleared = host.clearStorage("https://clear.test");
    await act(async () => {});
    const props = wvFor("https://clear.test");
    expect(String(props.injectedJavaScript)).toContain("localStorage.clear()");
    act(() => {
      props.onMessage({ nativeEvent: { data: "__psf_storage_cleared__" } });
    });
    await expect(cleared).resolves.toBeUndefined();
  });

  it("shares session storage with the assist WebView", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://session.test");
    pending.catch(() => {});
    await act(async () => {});
    const props = wvFor("https://session.test");
    // DOM storage (localStorage) + cookies must be enabled so a session warmed
    // in the visible assist modal is reused by the hidden fetch pool.
    expect(props.domStorageEnabled).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(true);
    expect(props.thirdPartyCookiesEnabled).toBe(true);
  });

  it("rejects with BrowserUnavailableError once the queue is full", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;

    // 2 active + MAX_QUEUE (25) queued = 27 in flight; the 28th call finds the
    // queue already at MAX_QUEUE and must reject.
    const settled: boolean[] = [];
    for (let i = 0; i < 27; i++) {
      const p = host.load(`https://q${i}.test`);
      settled.push(false);
      p.then(
        () => {
          settled[i] = true;
        },
        () => {
          settled[i] = true;
        },
      );
    }
    await act(async () => {});
    expect(settled).toEqual(new Array(27).fill(false));

    await expect(host.load("https://overflow.test")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
    await expect(host.load("https://overflow2.test")).rejects.toThrow(
      "queue full",
    );
    expect(settled).toEqual(new Array(27).fill(false));
  });
});

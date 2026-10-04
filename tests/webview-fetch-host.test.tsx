// @vitest-environment jsdom
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

const wvProps = vi.hoisted(() => ({ current: null as any }));
vi.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    wvProps.current = props;
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

describe("WebViewFetchHost", () => {
  beforeEach(() => {
    wvProps.current = null;
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
    expect(wvProps.current?.source?.uri).toBe("https://example.com");
    expect(String(wvProps.current?.injectedJavaScript)).toContain(".price");

    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "<html>x</html>" } });
    });
    await expect(pending).resolves.toBe("<html>x</html>");
  });

  it("rejects when the WebView errors", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://x.test");
    await act(async () => {});
    act(() => {
      wvProps.current.onError({ nativeEvent: { description: "boom" } });
    });
    await expect(pending).rejects.toThrow("boom");
  });

  it("serializes requests, one WebView load at a time", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test");
    const b = host.load("https://b.test");
    await act(async () => {});
    expect(wvProps.current.source.uri).toBe("https://a.test");

    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "A" } });
    });
    await expect(a).resolves.toBe("A");

    await act(async () => {});
    expect(wvProps.current.source.uri).toBe("https://b.test");
    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "B" } });
    });
    await expect(b).resolves.toBe("B");
  });

  it("rejects queued work when unmounted", async () => {
    const { unmount } = render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://x.test");
    await act(async () => {});
    unmount();
    await expect(pending).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(pending).rejects.toThrow();
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
    expect(wvProps.current.source.uri).toBe("https://slow.test");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await expect(pending).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(pending).rejects.toThrow(/timed out/i);
  });

  it("ignores stale events from a superseded request", async () => {
    vi.useFakeTimers();
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test", { timeoutMs: 1000 });
    const b = host.load("https://b.test");
    a.catch(() => {});
    await act(async () => {});
    expect(wvProps.current.source.uri).toBe("https://a.test");
    const aProps = wvProps.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});
    await expect(a).rejects.toBeInstanceOf(BrowserUnavailableError);
    await expect(a).rejects.toThrow(/timed out/i);
    expect(wvProps.current.source.uri).toBe("https://b.test");

    let bSettled = false;
    b.then(
      () => {
        bSettled = true;
      },
      () => {
        bSettled = true;
      },
    );

    act(() => {
      aProps.onMessage({ nativeEvent: { data: "A" } });
    });
    await act(async () => {});
    expect(bSettled).toBe(false);

    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "B" } });
    });
    await expect(b).resolves.toBe("B");
  });

  it("allows http(s) navigations and blocks non-web schemes", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://nav.test");
    pending.catch(() => {});
    await act(async () => {});

    const shouldLoad = wvProps.current.onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: "https://nav.test/page" })).toBe(true);
    expect(shouldLoad({ url: "http://nav.test" })).toBe(true);
    expect(shouldLoad({ url: "about:blank" })).toBe(true);
    expect(shouldLoad({ url: "intent://scan/#Intent;scheme=zxing;end" })).toBe(false);
    expect(shouldLoad({ url: "market://details?id=x" })).toBe(false);
    expect(shouldLoad({ url: "tel:+123456" })).toBe(false);
  });

  it("rejects with BrowserUnavailableError once the queue is full", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;

    // 1 active + MAX_QUEUE (25) queued = 26 in flight; the 27th call is the
    // first that finds the queue already at MAX_QUEUE and must reject.
    const settled: boolean[] = [];
    for (let i = 0; i < 26; i++) {
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
    expect(settled).toEqual(new Array(26).fill(false));

    await expect(host.load("https://overflow.test")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
    await expect(host.load("https://overflow2.test")).rejects.toThrow(
      "queue full",
    );
    expect(settled).toEqual(new Array(26).fill(false));
  });
});

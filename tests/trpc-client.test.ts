import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_REVOKED_ERR_MSG } from "@/shared/const";

const state = vi.hoisted(() => ({
  appState: "active" as "active" | "background",
}));

vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

vi.mock("../lib/storage", () => ({ getSettings: vi.fn(async () => null) }));
vi.mock("../lib/_core/auth", () => ({ getSessionToken: vi.fn(async () => null) }));
vi.mock("../lib/device-id", () => ({ getDeviceId: vi.fn(async () => undefined) }));

const handleDeviceRevoked = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../lib/device-revoked", () => ({ handleDeviceRevoked }));

vi.mock("../lib/background-safe-timers", () => ({
  getBackgroundAppState: () => state.appState,
}));

const backgroundFetch = vi.hoisted(() =>
  vi.fn(async () => ({ html: "ok", status: 200 })),
);
vi.mock("../lib/background-fetch", () => ({ backgroundFetch }));

// Capture the options the app passes into the links so the custom fetch and
// the revoked-device link can be exercised without a real tRPC transport.
const captured: { http?: Record<string, unknown> } = vi.hoisted(() => ({}));
vi.mock("@trpc/client", () => ({
  httpBatchLink: (opts: Record<string, unknown>) => {
    captured.http = opts;
    return { __http: opts };
  },
}));

vi.mock("@trpc/react-query", () => ({
  createTRPCReact: () => ({ createClient: (cfg: unknown) => cfg }),
}));

import { observable } from "@trpc/server/observable";
import { createTRPCClient } from "../lib/trpc";

type Client = {
  links: unknown[];
};
type HttpOpts = {
  url: string;
  fetch: (
    url: string,
    options?: { headers?: Record<string, string> },
  ) => Promise<Response>;
  headers: () => Promise<Record<string, string>>;
  transformer: unknown;
};

function httpOpts(): HttpOpts {
  return captured.http as unknown as HttpOpts;
}

const globalFetch = vi.fn();

beforeEach(() => {
  state.appState = "active";
  backgroundFetch.mockClear();
  backgroundFetch.mockResolvedValue({ html: "ok", status: 200 });
  handleDeviceRevoked.mockClear();
  globalFetch.mockReset();
  vi.stubGlobal("fetch", globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createTRPCClient", () => {
  it("configures the API URL, superjson transformer, and auth headers", () => {
    const client = createTRPCClient() as unknown as Client;
    expect(client.links).toHaveLength(2);
    const opts = httpOpts();
    expect(opts.url).toBe("https://api.test/api/trpc");
    expect(opts.transformer).toBeDefined();
    expect(typeof opts.headers).toBe("function");
  });

  it("uses the foreground fetch with credentials and an abort deadline", async () => {
    createTRPCClient();
    globalFetch.mockResolvedValue(new Response("body", { status: 200 }));
    const res = await httpOpts().fetch("https://api.test/api/trpc", {
      headers: { a: "b" },
    });
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalFetch.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/trpc");
    expect(init.credentials).toBe("include");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(await res.text()).toBe("body");
    expect(backgroundFetch).not.toHaveBeenCalled();
  });

  it("aborts the foreground fetch after the 15s deadline", async () => {
    createTRPCClient();
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalFetch.mockImplementation(
      (_url: unknown, init: { signal: AbortSignal }) => {
        signal = init.signal;
        return new Promise<Response>(() => {});
      },
    );
    void httpOpts().fetch("https://api.test/api/trpc");
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(signal!.aborted).toBe(true);
  });

  it("uses the native background fetch with a tight deadline when backgrounded", async () => {
    state.appState = "background";
    createTRPCClient();
    backgroundFetch.mockResolvedValue({ html: "bg", status: 207 });
    const res = await httpOpts().fetch("https://api.test/api/trpc", {
      headers: { h: "1" },
    });
    expect(backgroundFetch).toHaveBeenCalledWith(
      "https://api.test/api/trpc",
      4_000,
      { h: "1" },
    );
    expect(await res.text()).toBe("bg");
    expect(res.status).toBe(207);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe("revokedDeviceLink", () => {
  function runLink(error: Error): Promise<void> {
    const client = createTRPCClient() as unknown as { links: unknown[] };
    const link = client.links[0] as () => (args: unknown) => {
      subscribe: (o: {
        next: () => void;
        error: (e: unknown) => void;
        complete: () => void;
      }) => void;
    };
    const next = () =>
      observable<unknown, Error>((observer) => {
        observer.error(error);
      });
    const linkInstance = link()({ op: {}, next } as unknown);
    return new Promise((resolve) => {
      linkInstance.subscribe({
        next: () => {},
        error: () => resolve(),
        complete: () => resolve(),
      });
    });
  }

  it("clears the session on the device-revoked error", async () => {
    await runLink(new Error(DEVICE_REVOKED_ERR_MSG));
    expect(handleDeviceRevoked).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated errors", async () => {
    await runLink(new Error("some other failure"));
    expect(handleDeviceRevoked).not.toHaveBeenCalled();
  });
});

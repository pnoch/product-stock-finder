import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockUnregisterMutate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    notifications: { unregisterPushToken: { mutate: mockUnregisterMutate } },
  }),
}));

import { disablePush } from "../src/lib/web-push";
import {
  unregisterServerToken,
  PENDING_UNREGISTER_KEY,
} from "../src/lib/push-unregister";

const fakeClient = () => ({
  notifications: { unregisterPushToken: { mutate: mockUnregisterMutate } },
});

function stubPushSupport() {
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: { getRegistration: async () => undefined },
    configurable: true,
  });
  (window as unknown as Record<string, unknown>).PushManager = function () {};
  Object.defineProperty(window, "Notification", {
    value: function () {},
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  stubPushSupport();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("disablePush unregister retry flag", () => {
  it("flags unregister for retry when offline", async () => {
    mockUnregisterMutate.mockRejectedValue(new Error("offline"));
    await disablePush();
    expect(localStorage.getItem(PENDING_UNREGISTER_KEY)).toBe("1");
  });

  it("clears the flag when unregister succeeds", async () => {
    localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    await disablePush();
    expect(localStorage.getItem(PENDING_UNREGISTER_KEY)).toBeNull();
  });

  it("bounds the unregister attempt with a timeout", async () => {
    vi.useFakeTimers();
    mockUnregisterMutate.mockReturnValue(new Promise(() => {}));
    const pending = disablePush();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(mockUnregisterMutate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_UNREGISTER_KEY)).toBe("1");
  });

  it("unregisterServerToken resolves true on success, false on timeout", async () => {
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    await expect(unregisterServerToken(fakeClient())).resolves.toBe(true);
    vi.useFakeTimers();
    mockUnregisterMutate.mockReturnValue(new Promise(() => {}));
    const pending = unregisterServerToken(fakeClient());
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBe(false);
  });
});

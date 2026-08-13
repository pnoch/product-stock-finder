import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import { createTRPCClient } from "../lib/trpc";
import {
  uploadNotificationConfig,
  pullNotificationEvents,
} from "../lib/server-notifications";

const mockedCreateClient = vi.mocked(createTRPCClient);

function mockClient(handlers: {
  uploadConfig?: () => Promise<{ accepted: boolean }>;
  pull?: () => Promise<{ events: unknown[] }>;
}) {
  mockedCreateClient.mockReturnValue({
    notifications: {
      uploadConfig: { mutate: handlers.uploadConfig },
      pull: { query: handlers.pull },
    },
  } as unknown as ReturnType<typeof createTRPCClient>);
}

describe("uploadNotificationConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads the config and returns true", async () => {
    const mutate = vi.fn().mockResolvedValue({ accepted: true });
    mockClient({ uploadConfig: mutate });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(true);
    expect(mutate).toHaveBeenCalledWith({
      deviceId: "dev-1",
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
  });

  it("returns false when the mutate rejects", async () => {
    mockClient({ uploadConfig: vi.fn().mockRejectedValue(new Error("network")) });
    const ok = await uploadNotificationConfig("dev-1", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect(ok).toBe(false);
  });
});

describe("pullNotificationEvents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns events from the server", async () => {
    const query = vi.fn().mockResolvedValue({ events: [{ id: "e1" }] });
    mockClient({ pull: query });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([{ id: "e1" }]);
    expect(query).toHaveBeenCalledWith({ deviceId: "dev-1" });
  });

  it("returns an empty array when the query rejects", async () => {
    mockClient({ pull: vi.fn().mockRejectedValue(new Error("network")) });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });

  it("returns an empty array when the query times out", async () => {
    mockClient({
      pull: vi.fn().mockImplementation(
        () =>
          new Promise<{ events: unknown[] }>((resolve) =>
            setTimeout(() => resolve({ events: [] }), 10_000),
          ),
      ),
    });
    const events = await pullNotificationEvents("dev-1");
    expect(events).toEqual([]);
  });
});
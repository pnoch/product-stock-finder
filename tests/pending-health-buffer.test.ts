import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  getPendingHealthEvents: vi.fn(),
  savePendingHealthEvents: vi.fn(),
}));

import { uploadHealthEventToServer } from "../lib/server-notifications";
import { getPendingHealthEvents, savePendingHealthEvents } from "../lib/storage";
import { MAX_UPLOAD_HEALTH_EVENTS } from "../shared/const";

function event(i: number) {
  return {
    distributorId: `d${i}`,
    distributorName: `D${i}`,
    status: "blocked" as const,
    title: "t",
    body: "b",
    createdAt: i,
  };
}

describe("pending health event buffer cap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the buffer at or below the upload cap", async () => {
    const existing = Array.from({ length: MAX_UPLOAD_HEALTH_EVENTS }, (_, i) =>
      event(i),
    );
    vi.mocked(getPendingHealthEvents).mockResolvedValue(existing);

    await uploadHealthEventToServer(event(9999));

    expect(savePendingHealthEvents).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(savePendingHealthEvents).mock.calls[0]![0];
    expect(saved).toHaveLength(MAX_UPLOAD_HEALTH_EVENTS);
    // Newest is retained, oldest dropped.
    expect(saved[saved.length - 1]!.createdAt).toBe(9999);
    expect(saved[0]!.createdAt).toBe(1);
  });

  it("appends without trimming when under the cap", async () => {
    vi.mocked(getPendingHealthEvents).mockResolvedValue([event(1)]);
    await uploadHealthEventToServer(event(2));
    const saved = vi.mocked(savePendingHealthEvents).mock.calls[0]![0];
    expect(saved.map((e) => e.createdAt)).toEqual([1, 2]);
  });
});

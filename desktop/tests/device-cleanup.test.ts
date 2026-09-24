import { describe, it, expect, vi } from "vitest";
import { cleanupStaleDevices } from "../src/lib/device-cleanup";

function makeClient(removed = 2) {
  return {
    devices: {
      cleanupStale: {
        mutate: vi.fn().mockResolvedValue({ removed }),
      },
    },
  };
}

describe("cleanupStaleDevices", () => {
  it("returns the removed count", async () => {
    const client = makeClient(3);
    await expect(cleanupStaleDevices(client)).resolves.toBe(3);
    expect(client.devices.cleanupStale.mutate).toHaveBeenCalledOnce();
  });

  it("returns 0 when the mutation fails", async () => {
    const client = makeClient();
    client.devices.cleanupStale.mutate.mockRejectedValue(new Error("offline"));
    await expect(cleanupStaleDevices(client)).resolves.toBe(0);
  });

  it("returns 0 on timeout instead of hanging", async () => {
    const client = makeClient();
    client.devices.cleanupStale.mutate.mockImplementation(() => new Promise(() => {}));
    await expect(cleanupStaleDevices(client, 5)).resolves.toBe(0);
  });
});

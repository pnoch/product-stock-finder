import { describe, expect, it, vi } from "vitest";

const enable = vi.fn(async () => {});
const disable = vi.fn(async () => {});
vi.mock("@/lib/background-service", () => ({
  enableBackgroundService: () => enable(),
  disableBackgroundService: () => disable(),
}));

import { applyBackgroundServiceToggle } from "@/lib/background-service-toggle";

describe("applyBackgroundServiceToggle", () => {
  it("enables when on and disables when off", async () => {
    await applyBackgroundServiceToggle(true);
    expect(enable).toHaveBeenCalledTimes(1);
    await applyBackgroundServiceToggle(false);
    expect(disable).toHaveBeenCalledTimes(1);
  });
});

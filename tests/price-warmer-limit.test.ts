import { describe, expect, it } from "vitest";
import { pLimit } from "../server/prices";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("pLimit", () => {
  it("keeps draining the queue after a synchronous throw", async () => {
    const limit = pLimit(1);
    const order: string[] = [];
    const results = await Promise.race([
      Promise.allSettled([
        limit((): Promise<string> => {
          throw new Error("sync boom");
        }),
        limit(async () => {
          order.push("second");
          return "ok";
        }),
      ]),
      sleep(2000).then((): "timeout" => "timeout"),
    ]);
    expect(results).not.toBe("timeout");
    expect(order).toEqual(["second"]);
  });

  it("resolves values in completion order under concurrency", async () => {
    const limit = pLimit(2);
    const out = await Promise.all([
      limit(async () => "a"),
      limit(async () => "b"),
    ]);
    expect(out).toEqual(["a", "b"]);
  });
});

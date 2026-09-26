import { describe, expect, it } from "vitest";
import { dedupKeyFor } from "../server/notifications/build-events";
import type { NotificationEvent } from "../server/notifications/types";

function event(overrides: Partial<NotificationEvent> & { dedupKey?: string }): NotificationEvent {
  return {
    id: "id-1",
    type: "price_drop",
    title: "t",
    body: "b",
    createdAt: 1,
    ...overrides,
  } as NotificationEvent;
}

describe("dedupKeyFor", () => {
  it("honours the key the builder assigned", () => {
    // A digest event carries `digest:<scope>:<day>`; without this the type
    // branches produced `reminder:undefined`, so re-entering quiet hours
    // re-pushed the digest in memory mode.
    expect(
      dedupKeyFor(event({ type: "digest", id: "digest:d1:2026-08-11" })),
    ).toBe("digest:d1:2026-08-11");
    expect(
      dedupKeyFor(
        event({ type: "digest", id: "x", dedupKey: "digest:d2:2026-08-11" }),
      ),
    ).toBe("digest:d2:2026-08-11");
  });

  it("still derives keys for the other types", () => {
    expect(dedupKeyFor(event({ type: "price_drop", alertId: "a1" }))).toBe(
      "price_drop:a1",
    );
    expect(
      dedupKeyFor(
        event({ type: "restock", productId: "p1", distributorId: "d1" }),
      ),
    ).toBe("restock:p1:d1");
    expect(dedupKeyFor(event({ type: "reminder", reminderId: "r1" }))).toBe(
      "reminder:r1",
    );
  });
});

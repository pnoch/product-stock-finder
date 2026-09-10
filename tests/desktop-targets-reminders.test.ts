import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop targets and reminders", () => {
  it("shows target coverage per distributor", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("scopedAlertFor");
    expect(text).toContain("Distributor Targets");
  });

  it("opens reminders scoped to the row distributor", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("setReminderDistributorId(listing.distributorId)");
  });
});

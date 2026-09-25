import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop targets and reminders", () => {
  it("shows target coverage per distributor", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("scopedAlertFor");
    expect(text).toContain("Distributor Targets");
  });

  it("keeps the row scoped to a per-distributor alert", async () => {
    // Falling back to the product-wide alert made `alert` truthy for every row,
    // hiding the "+" and making a per-distributor target impossible to add
    // (mobile scopes the row to per-distributor alerts only).
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const start = text.indexOf("Distributor Targets");
    const block = text.slice(start, text.indexOf("</ul>", start));
    expect(block).toContain(
      "scopedAlertFor(alerts, product.id, listing.distributorId, listing.currency)",
    );
    expect(block).not.toContain("?? productWideAlert");
  });

  it("opens reminders scoped to the row distributor", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("setReminderDistributorId(listing.distributorId)");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

const STACKED_ACTION_CARDS = [
  "components/alerts/alert-card.tsx",
  "components/alerts/triggered-alert-card.tsx",
  "components/alerts/stock-watch-card.tsx",
  "components/alerts/reminder-card.tsx",
];

// `hitSlop` is measured in dp, so a 44dp slop on a 36dp icon expands ~115px at
// 420dpi — far past the 8dp gap between stacked edit/snooze/delete buttons. The
// last-rendered button then owns the whole column and the earlier ones become
// untappable (verified on device: tapping Edit's centre opened Snooze). The fix
// is a real 44x44 target, so these cards must not reintroduce `hitSlop`.
describe("stacked alert-card actions use real touch targets", () => {
  it.each(STACKED_ACTION_CARDS)("%s does not use hitSlop", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).not.toMatch(/hitSlop\s*=/);
  });

  it.each(STACKED_ACTION_CARDS)("%s uses IconActionButton", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).toContain("IconActionButton");
  });
});

describe("IconActionButton renders a 44x44 target", () => {
  it("declares min 44x44 and no hitSlop", () => {
    const src = readFileSync(
      join(ROOT, "components/ui/icon-action-button.tsx"),
      "utf8",
    );
    expect(src).toMatch(/minHeight:\s*44/);
    expect(src).toMatch(/minWidth:\s*44/);
    expect(src).not.toMatch(/hitSlop\s*=/);
  });
});

// Enabling the digest made the whole card vanish: `digest` needs a snapshot,
// but no snapshot exists until the first digest is actually delivered, and the
// placeholder only covered the `off` case. Verified on device: toggling
// Off -> Daily/Weekly removed the card entirely with no feedback.
describe("stats digest card survives the pre-snapshot window", () => {
  const src = readFileSync(join(ROOT, "app/stats.tsx"), "utf8");

  it("derives a placeholder for both off and enabled-but-pending", () => {
    expect(src).toContain("digestPlaceholder");
    expect(src).toContain('"pending"');
    expect(src).toMatch(/if \(!digestSnapshot\) return "pending"/);
  });

  it("renders the placeholder branch instead of null", () => {
    expect(src).toMatch(/digestPlaceholder \? \(/);
    expect(src).toContain("Digest scheduled");
    expect(src).toContain("Your first digest will appear here once it's sent.");
  });
});

// EditProductSheet was fully implemented but never rendered, so product editing
// was unreachable on mobile (the desktop ProductDetail already wires it up).
describe("mobile product detail exposes product editing", () => {
  const src = readFileSync(join(ROOT, "app/product/[id].tsx"), "utf8");

  it("imports and renders EditProductSheet", () => {
    expect(src).toContain("EditProductSheet");
    expect(src).toMatch(/<EditProductSheet/);
  });

  it("has an edit affordance in the sticky header", () => {
    expect(src).toContain('accessibilityLabel="Edit product"');
  });

  it("refreshes the screen after a save", () => {
    expect(src).toContain("onSaved");
  });
});

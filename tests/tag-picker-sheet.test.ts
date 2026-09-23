import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The tag picker is a bottom sheet whose "New tag name" input keeps focus (and
// the keyboard open) after Create tag. On Android the sheet renders inside a
// Modal Dialog window that does not resize for the IME, so a KeyboardAvoidingView
// does NOT lift it and the keyboard covers the Done button. The only escape was
// the hardware Back button — which closes the Modal via onRequestClose WITHOUT
// calling onApply, silently discarding the tag selection. The sheet must track
// the keyboard height itself and pad the bottom.
describe("TagPickerSheet keyboard handling", () => {
  const src = readFileSync(
    join(__dirname, "..", "components/tag-picker-sheet.tsx"),
    "utf8",
  );

  it("tracks the keyboard height via Keyboard listeners", () => {
    expect(src).toContain('Keyboard.addListener("keyboardDidShow"');
    expect(src).toContain('Keyboard.addListener("keyboardDidHide"');
    expect(src).toContain("paddingBottom: keyboardHeight");
  });

  it("keeps Done wired to onApply so the selection is committed", () => {
    expect(src).toContain("if (onApply) onApply(selectedRef.current);");
    expect(src).toContain("onClose();");
  });
});

// The tag manager's rename input keeps the keyboard open. Without
// keyboardShouldPersistTaps="handled" on the sheet's ScrollView, the first tap on
// the Confirm/Cancel buttons is swallowed by the keyboard dismissal — so a
// rename silently did nothing until the user tapped a second time (verified on
// device: one tap left the row in edit mode, two taps committed it). The same
// swallow applies to any tappable row inside a sheet ScrollView while its text
// input holds focus, so all three tag sheets must opt in.
describe("tag sheets let taps through while the keyboard is open", () => {
  it.each([
    "components/tag-manage-sheet.tsx",
    "components/tag-picker-sheet.tsx",
    "components/bulk-tag-sheet.tsx",
  ])("%s sets keyboardShouldPersistTaps", (rel) => {
    const src = readFileSync(join(__dirname, "..", rel), "utf8");
    expect(src).toContain('keyboardShouldPersistTaps="handled"');
  });

  it("wires Confirm rename to handleRename", () => {
    const src = readFileSync(
      join(__dirname, "..", "components/tag-manage-sheet.tsx"),
      "utf8",
    );
    expect(src).toContain("onPress={() => void handleRename(tag)}");
  });
});

// QA round 52: toggleTag optimistically updated the selection then awaited
// setProductTags with no try/catch, so a storage failure was an unhandled
// rejection and the UI showed a tag that was never persisted.
describe("TagPickerSheet reverts a failed tag toggle", () => {
  const src = readFileSync(
    join(__dirname, "..", "components/tag-picker-sheet.tsx"),
    "utf8",
  );

  it("wraps the write in try/catch and restores the previous selection", () => {
    const start = src.indexOf("const toggleTag");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("};", start));
    expect(block).toContain("try {");
    expect(block).toContain("catch");
    expect(block).toContain("updateSelected(cur)");
  });
});

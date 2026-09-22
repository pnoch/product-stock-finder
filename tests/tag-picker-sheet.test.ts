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

import { describe, expect, it } from "vitest";
import { resolveToastColors } from "../lib/toast-colors";

const light = {
  foreground: "#0F172A",
  background: "#FFFFFF",
  primary: "#0F52BA",
  error: "#EF4444",
  border: "#E2E8F0",
};

const dark = {
  foreground: "#F1F5F9",
  background: "#0A0E1A",
  primary: "#3B7DD8",
  error: "#F87171",
  border: "#1E293B",
};

describe("resolveToastColors", () => {
  it("pairs success background with readable text in light mode", () => {
    const { bg, text } = resolveToastColors(light, "success");
    expect(bg).not.toBe(text);
  });

  it("pairs success background with readable text in dark mode", () => {
    const { bg, text } = resolveToastColors(dark, "success");
    expect(bg).not.toBe(text);
    expect(text).toBe(dark.background);
  });

  it("keeps white text on primary/error backgrounds", () => {
    expect(resolveToastColors(light, "info").text).toBe("#fff");
    expect(resolveToastColors(light, "error").text).toBe("#fff");
  });
});

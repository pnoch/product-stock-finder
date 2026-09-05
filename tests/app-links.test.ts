import { describe, expect, it } from "vitest";
import { getAndroidIntentFilters } from "../app.config";

describe("Android app links", () => {
  it("adds an HTTPS intent filter for the configured web host", () => {
    const filters = getAndroidIntentFilters({
      scheme: "productstockfinder",
      webHost: "app.example.com",
    });
    expect(
      filters.some((filter) =>
        filter.data?.some(
          (entry: { scheme?: string; host?: string }) =>
            entry.scheme === "https" && entry.host === "app.example.com",
        ),
      ),
    ).toBe(true);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { openListingUrl } from "../lib/listing-utils";

vi.mock("react-native", () => ({
  Linking: { canOpenURL: vi.fn(), openURL: vi.fn() },
}));
vi.mock("@/lib/alert", () => ({ showAlert: vi.fn() }));

import { Linking } from "react-native";
import { showAlert } from "@/lib/alert";

describe("openListingUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens supported URLs", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(true);
    await openListingUrl("https://example.com/p");
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/p");
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("shows alert when no app can open URL", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
    await openListingUrl("https://example.com/p");
    expect(showAlert).toHaveBeenCalledWith("Cannot Open Link", expect.any(String));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("shows alert on throw", async () => {
    vi.mocked(Linking.canOpenURL).mockRejectedValue(new Error("fail"));
    await openListingUrl("https://example.com/p");
    expect(showAlert).toHaveBeenCalledWith("Error", expect.any(String));
  });
});

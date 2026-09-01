// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showAlert } from "../lib/alert";

const { alertMock } = vi.hoisted(() => ({ alertMock: vi.fn() }));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: alertMock },
}));

describe("showAlert on web", () => {
  beforeEach(() => {
    alertMock.mockClear();
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it("runs the destructive onPress when confirmed", () => {
    const onPress = vi.fn();
    showAlert("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
    expect(window.confirm).toHaveBeenCalledWith("Remove\n\nRemove this?");
    expect(onPress).toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("does not run the destructive onPress when cancelled", () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const onPress = vi.fn();
    showAlert("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows an informational alert and runs the OK onPress", () => {
    const onPress = vi.fn();
    showAlert("Done", "All set.", [{ text: "OK", onPress }]);
    expect(window.alert).toHaveBeenCalledWith("Done\n\nAll set.");
    expect(onPress).toHaveBeenCalled();
  });

  it("shows an informational alert when no buttons are given", () => {
    showAlert("Oops", "Something went wrong.");
    expect(window.alert).toHaveBeenCalledWith("Oops\n\nSomething went wrong.");
  });

  it("falls back to the title when no message is given", () => {
    showAlert("Just a title");
    expect(window.alert).toHaveBeenCalledWith("Just a title");
  });
});

describe("showAlert on native", () => {
  beforeEach(() => {
    alertMock.mockClear();
  });

  it("delegates to Alert.alert", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "ios";
    const onPress = vi.fn();
    showAlert("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
    expect(alertMock).toHaveBeenCalledWith("Remove", "Remove this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress },
    ]);
  });
});

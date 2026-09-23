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

  // Android shows at most 3 buttons and silently drops extras. When a "More…"
  // button is needed it must consume a slot, or the 4th button is dropped and
  // the remaining actions become unreachable.
  it("never passes more than 3 buttons on Android", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "android";
    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      { text: "C" },
      { text: "D" },
    ]);
    const buttons = alertMock.mock.calls.at(-1)![2] as unknown[];
    expect(buttons.length).toBeLessThanOrEqual(3);
    expect((buttons.at(-1) as { text: string }).text).toBe("More…");

    showAlert("Pick", "Choose one", [
      { text: "A" },
      { text: "B" },
      { text: "C" },
      { text: "D" },
      { text: "Cancel", style: "cancel" },
    ]);
    const withCancel = alertMock.mock.calls.at(-1)![2] as unknown[];
    expect(withCancel.length).toBeLessThanOrEqual(3);
    expect((withCancel.at(-1) as { text: string }).text).toBe("More…");
  });
});

import { describe, expect, it, vi } from "vitest";
import { goBackOrHome } from "../lib/navigation";

function mockRouter(canGoBack: boolean) {
  return {
    canGoBack: vi.fn(() => canGoBack),
    back: vi.fn(),
    replace: vi.fn(),
  };
}

describe("goBackOrHome", () => {
  it("goes back when history exists", () => {
    const router = mockRouter(true);
    goBackOrHome(router);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces with the fallback when there is no history (deep link)", () => {
    const router = mockRouter(false);
    goBackOrHome(router);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("honors a custom fallback", () => {
    const router = mockRouter(false);
    goBackOrHome(router, "/(tabs)/watchlist");
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/watchlist");
  });
});

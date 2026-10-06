import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  platform: "ios" as string,
  settings: { checkInterval: "daily" } as { checkInterval: string },
  registered: {} as Record<string, boolean>,
  intervals: {} as Record<string, number | null>,
  handlers: {} as Record<string, () => Promise<unknown>>,
  priceCore: vi.fn(async () => {}),
  testAll: vi.fn(async () => {}),
  checkAlerts: vi.fn(async () => {}),
  isTaskRegisteredAsync: vi.fn(async (name: string) => !!state.registered[name]),
  registerTaskAsync: vi.fn(async (name: string, opts: unknown) => {
    state.registered[name] = true;
    state.lastRegister = { name, opts };
  }),
  unregisterTaskAsync: vi.fn(async (name: string) => {
    state.registered[name] = false;
    state.lastUnregister = name;
  }),
  saveInterval: vi.fn(async (interval: number | null, name: string) => {
    state.intervals[name] = interval;
  }),
  lastRegister: undefined as unknown,
  lastUnregister: undefined as unknown,
  isPro: true,
  hasProvider: true,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
}));

vi.mock("expo-task-manager", () => ({
  defineTask: (name: string, handler: () => Promise<unknown>) => {
    state.handlers[name] = handler;
  },
  isTaskRegisteredAsync: (...a: unknown[]) =>
    state.isTaskRegisteredAsync(...(a as [string])),
}));

vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: (...a: unknown[]) =>
    state.registerTaskAsync(...(a as [string, unknown])),
  unregisterTaskAsync: (...a: unknown[]) =>
    state.unregisterTaskAsync(...(a as [string])),
}));

vi.mock("../lib/storage", () => ({
  getSettings: vi.fn(async () => state.settings),
  getBackgroundTaskInterval: vi.fn(
    async (name: string) => state.intervals[name] ?? null,
  ),
  saveBackgroundTaskInterval: (...a: unknown[]) =>
    state.saveInterval(...(a as [number | null, string])),
}));

vi.mock("../lib/background-tasks/instances", () => ({
  healthService: { testAllDistributors: state.testAll },
}));
vi.mock("../lib/background-tasks/health-alerts", () => ({
  checkHealthAlerts: state.checkAlerts,
}));
vi.mock("../lib/background-tasks/price-check", () => ({
  runPriceCheckCore: state.priceCore,
}));

vi.mock("@/lib/entitlements", () => ({
  getEntitlementState: vi.fn(async () => ({
    tier: state.isPro ? "pro" : "free",
    isPro: state.isPro,
  })),
  getEntitlementProvider: vi.fn(() =>
    state.hasProvider
      ? { getState: async () => ({ tier: "free", isPro: false }), purchase: async () => ({ tier: "pro", isPro: true }) }
      : null,
  ),
}));

import {
  HEALTH_PROBE_TASK,
  PRICE_CHECK_TASK,
  registerHealthProbeTask,
  registerPriceCheckTask,
  syncBackgroundTasks,
} from "../lib/background-tasks/tasks";
import { getSettings } from "../lib/storage";

beforeEach(() => {
  vi.clearAllMocks();
  state.platform = "ios";
  state.settings = { checkInterval: "daily" };
  state.registered = {};
  state.intervals = {};
  state.lastRegister = undefined;
  state.lastUnregister = undefined;
  state.isPro = true;
  state.hasProvider = true;
  state.priceCore.mockResolvedValue(undefined);
  state.testAll.mockResolvedValue(undefined);
  state.checkAlerts.mockResolvedValue(undefined);
});

describe("task handlers", () => {
  it("defines both tasks at module scope", () => {
    expect(Object.keys(state.handlers)).toEqual(
      expect.arrayContaining([PRICE_CHECK_TASK, HEALTH_PROBE_TASK]),
    );
  });

  it("returns Success/Failed from the price-check handler", async () => {
    expect(await state.handlers[PRICE_CHECK_TASK]!()).toBe("success");
    state.priceCore.mockRejectedValueOnce(new Error("boom"));
    expect(await state.handlers[PRICE_CHECK_TASK]!()).toBe("failed");
  });

  it("runs the health probe then alerts, returning Success/Failed", async () => {
    expect(await state.handlers[HEALTH_PROBE_TASK]!()).toBe("success");
    expect(state.testAll).toHaveBeenCalledTimes(1);
    expect(state.checkAlerts).toHaveBeenCalledTimes(1);

    state.testAll.mockRejectedValueOnce(new Error("probe down"));
    expect(await state.handlers[HEALTH_PROBE_TASK]!()).toBe("failed");
  });
});

describe("registerPriceCheckTask", () => {
  it("does nothing on web", async () => {
    state.platform = "web";
    await registerPriceCheckTask();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
    expect(state.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("unregisters and clears the interval in manual mode", async () => {
    state.settings = { checkInterval: "manual" };
    state.registered[PRICE_CHECK_TASK] = true;
    await registerPriceCheckTask();
    expect(state.lastUnregister).toBe(PRICE_CHECK_TASK);
    expect(state.intervals[PRICE_CHECK_TASK]).toBeNull();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("clears the interval in manual mode even when not registered", async () => {
    state.settings = { checkInterval: "manual" };
    await registerPriceCheckTask();
    expect(state.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(state.intervals[PRICE_CHECK_TASK]).toBeNull();
  });

  it("does not register background monitoring for a free user when limits are enforced", async () => {
    state.hasProvider = true;
    state.isPro = false;
    state.settings = { checkInterval: "hourly" };
    state.registered[PRICE_CHECK_TASK] = true;
    await registerPriceCheckTask();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
    expect(state.lastUnregister).toBe(PRICE_CHECK_TASK);
    expect(state.intervals[PRICE_CHECK_TASK]).toBeNull();
  });

  it("still registers a free user's hourly task when no billing provider exists", async () => {
    state.hasProvider = false;
    state.isPro = false;
    state.settings = { checkInterval: "hourly" };
    await registerPriceCheckTask();
    expect(state.lastUnregister).toBeUndefined();
    expect(state.lastRegister).toEqual({
      name: PRICE_CHECK_TASK,
      opts: { minimumInterval: 60 },
    });
    expect(state.intervals[PRICE_CHECK_TASK]).toBe(60);
  });

  it("registers a missing hourly task with a 60-minute interval", async () => {
    state.settings = { checkInterval: "hourly" };
    await registerPriceCheckTask();
    expect(state.lastRegister).toEqual({
      name: PRICE_CHECK_TASK,
      opts: { minimumInterval: 60 },
    });
    expect(state.intervals[PRICE_CHECK_TASK]).toBe(60);
  });

  it("registers a missing daily task with a 1440-minute interval", async () => {
    state.settings = { checkInterval: "daily" };
    await registerPriceCheckTask();
    expect(state.lastRegister).toEqual({
      name: PRICE_CHECK_TASK,
      opts: { minimumInterval: 1440 },
    });
  });

  it("skips re-registration when the interval is unchanged", async () => {
    state.registered[PRICE_CHECK_TASK] = true;
    state.intervals[PRICE_CHECK_TASK] = 1440;
    await registerPriceCheckTask();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
    expect(state.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("re-registers when the interval changed", async () => {
    state.registered[PRICE_CHECK_TASK] = true;
    state.intervals[PRICE_CHECK_TASK] = 60;
    state.settings = { checkInterval: "daily" };
    await registerPriceCheckTask();
    expect(state.unregisterTaskAsync).toHaveBeenCalledWith(PRICE_CHECK_TASK);
    expect(state.lastRegister).toEqual({
      name: PRICE_CHECK_TASK,
      opts: { minimumInterval: 1440 },
    });
  });

  it("swallows settings/registration errors", async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("storage down"));
    await expect(registerPriceCheckTask()).resolves.toBeUndefined();
  });
});

describe("registerHealthProbeTask", () => {
  it("registers with the per-task interval marker", async () => {
    state.settings = { checkInterval: "hourly" };
    await registerHealthProbeTask();
    expect(state.lastRegister).toEqual({
      name: HEALTH_PROBE_TASK,
      opts: { minimumInterval: 60 },
    });
    expect(state.intervals[HEALTH_PROBE_TASK]).toBe(60);
  });

  it("skips re-registration when the interval is unchanged", async () => {
    state.registered[HEALTH_PROBE_TASK] = true;
    state.intervals[HEALTH_PROBE_TASK] = 1440;
    await registerHealthProbeTask();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("does nothing on web", async () => {
    state.platform = "web";
    await registerHealthProbeTask();
    expect(state.isTaskRegisteredAsync).not.toHaveBeenCalled();
  });

  it("unregisters and clears the interval in manual mode", async () => {
    state.settings = { checkInterval: "manual" };
    state.registered[HEALTH_PROBE_TASK] = true;
    await registerHealthProbeTask();
    expect(state.lastUnregister).toBe(HEALTH_PROBE_TASK);
    expect(state.intervals[HEALTH_PROBE_TASK]).toBeNull();
    expect(state.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("clears the interval in manual mode even when not registered", async () => {
    state.settings = { checkInterval: "manual" };
    await registerHealthProbeTask();
    expect(state.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(state.intervals[HEALTH_PROBE_TASK]).toBeNull();
  });

  it("swallows settings/registration errors", async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("storage down"));
    await expect(registerHealthProbeTask()).resolves.toBeUndefined();
  });
});

describe("syncBackgroundTasks", () => {
  it("registers both tasks", async () => {
    await syncBackgroundTasks();
    const names = (state.registerTaskAsync.mock.calls as unknown[][]).map(
      (c) => c[0],
    );
    expect(names).toEqual(
      expect.arrayContaining([PRICE_CHECK_TASK, HEALTH_PROBE_TASK]),
    );
  });
});

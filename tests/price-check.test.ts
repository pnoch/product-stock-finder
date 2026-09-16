import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product, PriceAlert } from "../lib/types";

// Hoisted mutable state so vi.mock factories can reference it safely
const state = vi.hoisted(() => ({
  alertsStore: [] as PriceAlert[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  permissionGranted: true,
  taskRegistered: false,
  taskInterval: null as number | null,
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
    healthAlerts: true,
  },
}));

// Mock storage + notifications so we can drive checkPriceDropsNow deterministically
vi.mock("../lib/storage", () => ({
  getAlerts: vi.fn(async () => state.alertsStore.map((a) => ({ ...a }))),
  getWatchlist: vi.fn(async () => state.watchlistStore),
  getSettings: vi.fn(async () => state.settingsStore),
  saveAlerts: vi.fn(async (alerts: PriceAlert[]) => {
    state.alertsStore.length = 0;
    state.alertsStore.push(...alerts.map((a) => ({ ...a })));
  }),
  deactivateAlert: vi.fn(async (alertId: string, triggeredPrice: number) => {
    state.alertsStore = state.alertsStore.map((a) =>
      a.id === alertId
        ? {
            ...a,
            isActive: false,
            triggeredAt: new Date().toISOString(),
            triggeredPrice,
          }
        : a,
    );
    return true;
  }),
  updateProductListings: vi.fn(async () => {}),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
  rearmAlert: vi.fn(async () => {}),
  getBackgroundTaskInterval: vi.fn(async () => state.taskInterval),
  saveBackgroundTaskInterval: vi.fn(async (minutes: number | null) => {
    state.taskInterval = minutes;
  }),
}));

vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  ensureNotificationPermission: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
  channelIdFor: vi.fn(() => undefined),
}));

vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));

vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
}));

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn(async (input: unknown) => {
    state.scheduledNotifications.push(input);
    return "notif-id";
  }),
}));

vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(async () => state.taskRegistered),
}));
vi.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(() => undefined),
}));
vi.mock("../lib/scrapers/utils", () => ({
  fetchWithRateLimit: vi.fn(async () => ""),
}));
vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(async () => null),
  uploadServerHistory: vi.fn(async () => {}),
}));

import {
  checkHealthAlerts,
  checkPriceDropsNow,
  createHealthCollector,
  registerHealthProbeTask,
  syncBackgroundTasks,
} from "../lib/background-price-check";
import { deactivateAlert } from "../lib/storage";
import {
  createHealthService,
  HealthSample,
} from "../lib/scrapers/health";
import {
  scheduleHealthAlert,
  scheduleHealthRecovery,
} from "../lib/notifications";
import * as BackgroundTask from "expo-background-task";

function makeListing(price: number, currency: string, stockStatus: string) {
  return {
    distributorId: "d1",
    productId: "p1",
    price,
    currency,
    stockStatus,
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
  };
}

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockHealthService(history: Record<string, HealthSample[]>) {
  return {
    getHealthHistory: vi.fn(async () => history),
  } as unknown as ReturnType<typeof createHealthService>;
}

beforeEach(() => {
  state.alertsStore.length = 0;
  state.watchlistStore = [];
  state.scheduledNotifications.length = 0;
  state.permissionGranted = true;
});

describe("checkPriceDropsNow", () => {
  it("does nothing when there are no active alerts", async () => {
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does nothing when the product has no listings", async () => {
    state.alertsStore.push(makeAlert());
    state.watchlistStore = [{ id: "p1", listings: [] } as unknown as Product];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does nothing when the best price is above the target", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(150, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
    expect(state.alertsStore[0]!.isActive).toBe(true);
  });

  it("fires a notification and deactivates the alert when price drops below target", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(90, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.isActive).toBe(false);
    expect(state.alertsStore[0]!.triggeredPrice).toBe(90);
    expect(state.alertsStore[0]!.triggeredAt).toBeTruthy();
  });

  it("converts listing price to the alert currency before comparing", async () => {
    // Alert in EUR, listing in USD. 100 USD -> 92 EUR. Target 95 EUR -> triggers.
    state.alertsStore.push(makeAlert({ targetPrice: 95, currency: "EUR" }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(100, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.triggeredPrice).toBeCloseTo(92);
  });

  it("ignores out-of-stock listings when computing the best price", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [
          makeListing(50, "USD", "out_of_stock"),
          makeListing(200, "USD", "in_stock"),
        ],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    // Best in-stock is 200, above target -> no trigger
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("skips alerts that were already triggered (duplicate-fire guard)", async () => {
    state.alertsStore.push(
      makeAlert({ isActive: true, triggeredAt: "2026-01-01" }),
    );
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(50, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does not notify when it loses the deactivate race", async () => {
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(90, "USD", "in_stock")],
      } as unknown as Product,
    ];
    // Another runner (background task vs foreground check) won the race and
    // transitioned the alert first.
    vi.mocked(deactivateAlert).mockResolvedValueOnce(false);
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
  });

  it("does not schedule when notification permission is denied", async () => {
    state.permissionGranted = false;
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(50, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    // requestNotificationPermissions returns false; no notification scheduled
    expect(state.scheduledNotifications).toHaveLength(0);
    // Alert must stay active so it can fire once permission is granted
    expect(state.alertsStore[0]!.isActive).toBe(true);
    expect(state.alertsStore[0]!.triggeredAt).toBeUndefined();
  });
});

describe("createHealthCollector", () => {
  function makeAdapter() {
    const store = new Map<string, string>();
    return {
      store,
      adapter: {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: async (key: string) => {
          store.delete(key);
        },
        multiRemove: async (keys: string[]) => {
          keys.forEach((k) => store.delete(k));
        },
      },
    };
  }

  it("flush records history samples", async () => {
    const { adapter } = makeAdapter();
    const service = createHealthService(adapter);
    const collector = createHealthCollector(service);
    collector.record("d1", "working");
    collector.record("d2", "blocked", "in cooldown");
    await collector.flush();
    const history = await service.getHealthHistory();
    expect(history["d1"]).toHaveLength(1);
    expect(history["d1"][0].status).toBe("working");
    expect(history["d2"]).toHaveLength(1);
    expect(history["d2"][0].status).toBe("blocked");
    expect(history["d2"][0].reason).toBe("in cooldown");
  });

  it("flush does nothing when no updates recorded", async () => {
    const { adapter } = makeAdapter();
    const service = createHealthService(adapter);
    const collector = createHealthCollector(service);
    await collector.flush();
    expect(await service.getHealthHistory()).toEqual({});
  });
});

describe("registerHealthProbeTask", () => {
  beforeEach(() => {
    vi.mocked(BackgroundTask.registerTaskAsync).mockClear();
    vi.mocked(BackgroundTask.unregisterTaskAsync).mockClear();
    state.taskRegistered = false;
    state.taskInterval = null;
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
  });

  it("registers with hourly interval when checkInterval is hourly", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    await registerHealthProbeTask();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith("health-probe", {
      minimumInterval: 60,
    });
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("registers with daily interval when checkInterval is daily", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    await registerHealthProbeTask();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith("health-probe", {
      minimumInterval: 1440,
    });
  });

  it("unregisters when checkInterval is manual", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
    state.taskRegistered = true;
    await registerHealthProbeTask();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith("health-probe");
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("does not re-register when already registered with the same interval", async () => {
    // Re-registering on every launch resets the OS scheduling window (iOS).
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    state.taskRegistered = true;
    state.taskInterval = 60;
    await registerHealthProbeTask();
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("re-registers when the interval changed", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    state.taskRegistered = true;
    state.taskInterval = 60;
    await registerHealthProbeTask();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith("health-probe");
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith("health-probe", {
      minimumInterval: 1440,
    });
  });
});

describe("syncBackgroundTasks", () => {
  beforeEach(() => {
    vi.mocked(BackgroundTask.registerTaskAsync).mockClear();
    vi.mocked(BackgroundTask.unregisterTaskAsync).mockClear();
    state.taskRegistered = false;
    state.taskInterval = null;
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
  });

  it("registers both tasks with hourly interval when checkInterval is hourly", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
      { minimumInterval: 60 },
    );
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 60 },
    );
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it("registers both tasks with daily interval when checkInterval is daily", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
      { minimumInterval: 1440 },
    );
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 1440 },
    );
  });

  it("unregisters both tasks when checkInterval is manual", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "manual" };
    state.taskRegistered = true;
    await syncBackgroundTasks();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(
      "price-drop-check",
    );
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(
      "health-probe",
    );
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });
});

describe("checkHealthAlerts", () => {
  beforeEach(() => {
    vi.mocked(scheduleHealthAlert).mockClear();
    vi.mocked(scheduleHealthRecovery).mockClear();
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: true,
      healthAlerts: true,
    };
  });

  it("fires scheduleHealthAlert when a distributor triggers", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "error", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthAlert).toHaveBeenCalledTimes(1);
  });

  it("does not fire when notificationsEnabled is false", async () => {
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: false,
    };
    await checkHealthAlerts(mockHealthService({}));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });

  it("does not fire when healthAlerts is false", async () => {
    state.settingsStore = { ...state.settingsStore, healthAlerts: false };
    await checkHealthAlerts(mockHealthService({}));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });

  it("does not fire when no distributor triggers", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "working", at: "2026-08-01T01:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthAlert).not.toHaveBeenCalled();
  });

  it("fires scheduleHealthRecovery when a distributor recovers", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).toHaveBeenCalledTimes(1);
    expect(scheduleHealthRecovery).toHaveBeenCalledWith("winncom-us", "error");
  });

  it("does not fire recovery when notificationsEnabled is false", async () => {
    state.settingsStore = {
      ...state.settingsStore,
      notificationsEnabled: false,
    };
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });

  it("does not fire recovery when healthAlerts is false", async () => {
    state.settingsStore = { ...state.settingsStore, healthAlerts: false };
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "error", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "working", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });

  it("does not fire recovery when no recovery in history", async () => {
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "error", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(scheduleHealthRecovery).not.toHaveBeenCalled();
  });
});

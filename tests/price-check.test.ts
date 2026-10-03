import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product, PriceAlert } from "../lib/types";

// Hoisted mutable state so vi.mock factories can reference it safely
const state = vi.hoisted(() => ({
  alertsStore: [] as PriceAlert[],
  watchlistStore: [] as Product[],
  scheduledNotifications: [] as unknown[],
  permissionGranted: true,
  taskRegistered: false,
  taskIntervals: {} as Record<string, number>,
  settingsStore: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    priceAlerts: true,
    stockAlerts: true,
    healthAlerts: true,
    basketAlertThreshold: null as number | null,
    quietHours: undefined as
      | { start: string; end: string; utcOffsetMinutes?: number }
      | undefined,
  },
  recordedNotifications: [] as Record<string, unknown>[],
  uploadedHealthEvents: [] as Record<string, unknown>[],
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
  recordNotificationEvent: vi.fn(async (e: Record<string, unknown>) => {
    state.recordedNotifications.push(e);
  }),
  getPriceDigestSnapshot: vi.fn(async () => null),
  savePriceDigestSnapshot: vi.fn(async () => {}),
  updateSettings: vi.fn(async (patch: Record<string, unknown>) => {
    state.settingsStore = { ...state.settingsStore, ...patch };
    return state.settingsStore;
  }),
  rearmAlert: vi.fn(async () => {}),
  getBackgroundTaskInterval: vi.fn(async (task: string) => state.taskIntervals[task] ?? null),
  saveBackgroundTaskInterval: vi.fn(async (minutes: number | null, task: string) => {
    if (minutes === null) delete state.taskIntervals[task];
    else state.taskIntervals[task] = minutes;
  }),
}));

vi.mock("../lib/notifications", () => ({
  requestNotificationPermissions: vi.fn(async () => state.permissionGranted),
  ensureNotificationPermission: vi.fn(async () => state.permissionGranted),
  scheduleHealthAlert: vi.fn(async () => "notif-id"),
  scheduleHealthRecovery: vi.fn(async () => "notif-id"),
  channelIdFor: vi.fn(() => undefined),
  immediateTrigger: vi.fn(() => null),
}));

vi.mock("../lib/restock", () => ({
  checkRestocks: vi.fn(async () => {}),
}));

vi.mock("../lib/server-notifications", () => ({
  syncServerNotifications: vi.fn(async () => {}),
  uploadHealthEventToServer: vi.fn(async (event: Record<string, unknown>) => {
    state.uploadedHealthEvents.push(event);
  }),
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

const webPush = vi.hoisted(() => ({ display: true }));
vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(() => webPush.display),
}));

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

beforeEach(async () => {
  state.alertsStore.length = 0;
  state.watchlistStore = [];
  state.scheduledNotifications.length = 0;
  state.permissionGranted = true;
  webPush.display = true;
  const { Platform } = await import("react-native");
  Platform.OS = "ios";
});

describe("checkPriceDropsNow", () => {
  it("joins an in-flight run instead of scraping everything twice", async () => {
    // A launch check, the background task and a foreground refresh can fire
    // close together; overlapping runs scraped every listing twice.
    state.alertsStore.push(makeAlert());
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(50, "USD", "in_stock")],
      } as unknown as Product,
    ];
    // Gate the first run inside its initial watchlist read, so the second call
    // is guaranteed to arrive while the first is still in flight.
    const { getWatchlist } = await import("../lib/storage");
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    vi.mocked(getWatchlist).mockImplementationOnce(async () => {
      await gate;
      return state.watchlistStore as never;
    });
    const first = checkPriceDropsNow();
    const second = checkPriceDropsNow();
    release();
    await Promise.all([first, second]);
    // The second call joined the first instead of starting its own run, so the
    // gated first read is the only one that ran the gate.
    expect(vi.mocked(getWatchlist)).toHaveBeenCalledTimes(3);
  });

  it("does nothing when there are no active alerts", async () => {
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(0);
    state.recordedNotifications = [];
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

  it("fires a price-rise alert when the price rises above target", async () => {
    state.alertsStore.push(makeAlert({ direction: "rise", targetPrice: 50 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(100, "USD", "in_stock")],
      } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.alertsStore[0]!.isActive).toBe(false);
  });

  it("re-arms the alert when the web notification cannot be shown", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "web";
    webPush.display = false;
    state.alertsStore.push(makeAlert({ targetPrice: 100 }));
    state.watchlistStore = [
      {
        id: "p1",
        listings: [makeListing(90, "USD", "in_stock")],
      } as unknown as Product,
    ];
    const { rearmAlert } = await import("../lib/storage");
    await checkPriceDropsNow();
    expect(vi.mocked(rearmAlert)).toHaveBeenCalledWith("a1");
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

  // The basket-alert sheet tells the user the threshold is in their display
  // currency, but the check hardcoded USD — so a EUR user's €500 threshold was
  // compared against a USD total and fired (or never fired) wrongly.
  it("evaluates the basket alert in the display currency", async () => {
    state.settingsStore = {
      ...state.settingsStore,
      displayCurrency: "EUR",
      basketAlertThreshold: 500,
    };
    // 520 USD -> 478.40 EUR (rate 0.92). Below the €500 threshold, so it must
    // fire; a USD total (520) would be above 500 and wrongly skip it.
    state.watchlistStore = [
      { id: "p1", listings: [makeListing(520, "USD", "in_stock")] } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.scheduledNotifications).toHaveLength(1);
    expect(state.settingsStore.basketAlertThreshold).toBeNull();
    // Recorded in the in-app history like the price-drop path (the core records
    // other event types too, so filter for the basket one).
    const basketEvents = state.recordedNotifications.filter(
      (e) => e.title === "Basket Alert",
    );
    expect(basketEvents).toHaveLength(1);
    expect(basketEvents[0]).toMatchObject({ type: "digest" });
  });

  it("sends a web basket alert and clears the threshold", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "web";
    webPush.display = true;
    state.settingsStore = {
      ...state.settingsStore,
      basketAlertThreshold: 1000,
    };
    state.watchlistStore = [
      { id: "p1", listings: [makeListing(50, "USD", "in_stock")] } as unknown as Product,
    ];
    await checkPriceDropsNow();
    expect(state.settingsStore.basketAlertThreshold).toBeNull();
  });

  it("leaves the basket threshold set when the web notification fails", async () => {
    const { Platform } = await import("react-native");
    Platform.OS = "web";
    webPush.display = false;
    state.settingsStore = {
      ...state.settingsStore,
      basketAlertThreshold: 1000,
    };
    state.watchlistStore = [
      { id: "p1", listings: [makeListing(50, "USD", "in_stock")] } as unknown as Product,
    ];
    await checkPriceDropsNow();
    // The alert must retry next run rather than being lost.
    expect(state.settingsStore.basketAlertThreshold).toBe(1000);
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

  it("sorts samples by time on read", async () => {
    // The alert/recovery detectors read positionally (`slice(-threshold)`), so
    // an unsorted store (a hand-edited/legacy payload) would misread the newest
    // samples.
    const { adapter, store } = makeAdapter();
    store.set(
      "distributor_health_history",
      JSON.stringify({
        d1: [
          { status: "blocked", at: "2026-01-03T00:00:00.000Z" },
          { status: "working", at: "2026-01-01T00:00:00.000Z" },
          { status: "blocked", at: "2026-01-02T00:00:00.000Z" },
        ],
      }),
    );
    const service = createHealthService(adapter);
    const history = await service.getHealthHistory();
    expect(history["d1"]!.map((s) => s.at)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    ]);
  });
});

describe("registerHealthProbeTask", () => {
  beforeEach(() => {
    vi.mocked(BackgroundTask.registerTaskAsync).mockClear();
    vi.mocked(BackgroundTask.unregisterTaskAsync).mockClear();
    state.taskRegistered = false;
    state.taskIntervals = {};
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
    state.taskIntervals = { "health-probe": 60 };
    await registerHealthProbeTask();
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("re-registers when the interval changed", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    state.taskRegistered = true;
    state.taskIntervals = { "health-probe": 60 };
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
    state.taskIntervals = {};
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

  // Both tasks share one interval marker, but the price task writes it before
  // the health task reads it — so after an interval change the health task saw
  // the *new* value and skipped re-registering, leaving it on the old interval.
  it("re-registers the health task when the interval changes hourly -> daily", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "daily" };
    state.taskRegistered = true;
    state.taskIntervals = { "price-drop-check": 60, "health-probe": 60 }; // both were last registered hourly
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 1440 },
    );
  });

  it("re-registers the health task when the interval changes daily -> hourly", async () => {
    state.settingsStore = { ...state.settingsStore, checkInterval: "hourly" };
    state.taskRegistered = true;
    state.taskIntervals = { "price-drop-check": 1440, "health-probe": 1440 };
    await syncBackgroundTasks();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
      "health-probe",
      { minimumInterval: 60 },
    );
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
      // Reset so the quiet-hours test cannot leak into its neighbours.
      quietHours: undefined,
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

  it("still detects and uploads a health transition during quiet hours", async () => {
    // Offset the window so "now" is inside it regardless of when the suite
    // runs, while the local OS notification stays suppressed inside
    // scheduleHealthAlert.
    const now = new Date();
    state.settingsStore = {
      ...state.settingsStore,
      quietHours: {
        start: "00:00",
        end: "23:59",
        utcOffsetMinutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
      },
    };
    state.uploadedHealthEvents = [];
    const history: Record<string, HealthSample[]> = {
      "winncom-us": [
        { status: "working", at: "2026-08-01T00:00:00Z" },
        { status: "error", at: "2026-08-01T01:00:00Z" },
        { status: "error", at: "2026-08-01T02:00:00Z" },
        { status: "error", at: "2026-08-01T03:00:00Z" },
      ],
    };
    await checkHealthAlerts(mockHealthService(history));
    expect(state.uploadedHealthEvents).toHaveLength(1);
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

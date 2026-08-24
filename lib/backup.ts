import type {
  AppSettings,
  BackOrderReminder,
  PriceAlert,
  Product,
} from "./types";

export const BACKUP_FORMAT = "product-stock-finder-backup";
export const BACKUP_VERSION = 1;

// Baseline used to tell "explicitly customized on the exporting device" apart
// from "merely carried along at its default value": default-valued fields in a
// backup never clobber local customizations during import.
const SETTING_DEFAULTS: Record<string, unknown> = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
};

export interface BackupInput {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
}

export interface BackupData {
  format: string;
  version: number;
  exportedAt: string;
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings?: AppSettings;
}

export function buildBackup(input: BackupInput): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      watchlist: input.watchlist,
      alerts: input.alerts,
      reminders: input.reminders,
      stockWatches: input.stockWatches,
      settings: input.settings,
    },
    null,
    2,
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseBackup(json: string): BackupData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) return null;
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    return null;
  }
  return {
    format: BACKUP_FORMAT,
    version: obj.version,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    watchlist: asArray<Product>(obj.watchlist),
    alerts: asArray<PriceAlert>(obj.alerts),
    reminders: asArray<BackOrderReminder>(obj.reminders),
    stockWatches: asArray<BackOrderReminder>(obj.stockWatches),
    settings:
      obj.settings && typeof obj.settings === "object"
        ? (obj.settings as AppSettings)
        : undefined,
  };
}

export interface MergeCounts {
  watchlistAdded: number;
  watchlistUpdated: number;
  alertsAdded: number;
  alertsUpdated: number;
  remindersAdded: number;
  remindersUpdated: number;
  stockWatchesAdded: number;
  stockWatchesUpdated: number;
}

export interface ApplyResult {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
  settingsApplied: boolean;
  counts: MergeCounts;
  touchedIds: {
    watchlist: string[];
    alerts: string[];
    reminders: string[];
    stockWatches: string[];
  };
}

interface MergeOutcome<T> {
  merged: T[];
  added: number;
  updated: number;
  touched: string[];
}

// Union keyed on id; incoming (backup) copy wins conflicts; device-only items stay.
function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): MergeOutcome<T> {
  const map = new Map<string, T>();
  for (const item of current) map.set(item.id, item);
  let added = 0;
  let updated = 0;
  const touched: string[] = [];
  for (const item of incoming) {
    if (map.has(item.id)) updated += 1;
    else added += 1;
    map.set(item.id, item);
    touched.push(item.id);
  }
  return { merged: [...map.values()], added, updated, touched };
}

function mergeSettings(current: AppSettings, incoming: AppSettings): AppSettings {
  const merged = { ...current } as Record<string, unknown>;
  const incomingRecord = incoming as unknown as Record<string, unknown>;
  for (const key of Object.keys(incomingRecord)) {
    if (key === "tagDefinitions") continue;
    if (
      key in SETTING_DEFAULTS &&
      SETTING_DEFAULTS[key] === incomingRecord[key]
    ) {
      continue;
    }
    merged[key] = incomingRecord[key];
  }
  if (incoming.tagDefinitions) {
    merged.tagDefinitions = {
      ...(current.tagDefinitions ?? {}),
      ...incoming.tagDefinitions,
    };
  }
  return merged as unknown as AppSettings;
}

export function applyBackup(
  backup: BackupData,
  current: BackupInput,
): ApplyResult {
  const watchlist = mergeById(current.watchlist, backup.watchlist);
  const alerts = mergeById(current.alerts, backup.alerts);
  const reminders = mergeById(current.reminders, backup.reminders);
  const stockWatches = mergeById(current.stockWatches, backup.stockWatches);

  const settingsApplied = backup.settings !== undefined;

  return {
    watchlist: watchlist.merged,
    alerts: alerts.merged,
    reminders: reminders.merged,
    stockWatches: stockWatches.merged,
    settings: settingsApplied
      ? mergeSettings(current.settings, backup.settings!)
      : current.settings,
    settingsApplied,
    counts: {
      watchlistAdded: watchlist.added,
      watchlistUpdated: watchlist.updated,
      alertsAdded: alerts.added,
      alertsUpdated: alerts.updated,
      remindersAdded: reminders.added,
      remindersUpdated: reminders.updated,
      stockWatchesAdded: stockWatches.added,
      stockWatchesUpdated: stockWatches.updated,
    },
    touchedIds: {
      watchlist: watchlist.touched,
      alerts: alerts.touched,
      reminders: reminders.touched,
      stockWatches: stockWatches.touched,
    },
  };
}

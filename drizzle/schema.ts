import {
  bigint,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const watchlistItems = mysqlTable(
  "watchlist_items",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: varchar("productId", { length: 191 }).notNull(),
    data: json("data"),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    /** Client-clock timestamp of the last accepted write (LWW ordering). */
    clientUpdatedAtMs: bigint("clientUpdatedAtMs", { mode: "number" }),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.productId] }),
    index("idx_watchlist_user_updated").on(table.userId, table.updatedAtMs),
    index("idx_watchlist_user_deleted").on(table.userId, table.deletedAtMs),
  ],
);

export const priceAlerts = mysqlTable(
  "price_alerts",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alertId: varchar("alertId", { length: 191 }).notNull(),
    data: json("data"),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    /** Client-clock timestamp of the last accepted write (LWW ordering). */
    clientUpdatedAtMs: bigint("clientUpdatedAtMs", { mode: "number" }),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.alertId] }),
    index("idx_alerts_user_updated").on(table.userId, table.updatedAtMs),
    index("idx_alerts_user_deleted").on(table.userId, table.deletedAtMs),
  ],
);

export const backOrderReminders = mysqlTable(
  "back_order_reminders",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderId: varchar("reminderId", { length: 191 }).notNull(),
    data: json("data"),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    /** Client-clock timestamp of the last accepted write (LWW ordering). */
    clientUpdatedAtMs: bigint("clientUpdatedAtMs", { mode: "number" }),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.reminderId] }),
    index("idx_reminders_user_updated").on(table.userId, table.updatedAtMs),
    index("idx_reminders_user_deleted").on(table.userId, table.deletedAtMs),
  ],
);

export const appSettings = mysqlTable("app_settings", {
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  data: json("data"),
  updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
  /** Client-clock timestamp of the last accepted write (LWW ordering). */
  clientUpdatedAtMs: bigint("clientUpdatedAtMs", { mode: "number" }),
  deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
});

export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItemRow = typeof watchlistItems.$inferInsert;
export type PriceAlertRow = typeof priceAlerts.$inferSelect;
export type InsertPriceAlertRow = typeof priceAlerts.$inferInsert;
export type BackOrderReminderRow = typeof backOrderReminders.$inferSelect;
export type InsertBackOrderReminderRow = typeof backOrderReminders.$inferInsert;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type InsertAppSettingsRow = typeof appSettings.$inferInsert;

export const priceCache = mysqlTable(
  "price_cache",
  {
    distributorId: varchar("distributorId", { length: 64 }).notNull(),
    modelNumber: varchar("modelNumber", { length: 128 }).notNull(),
    price: double("price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    stockStatus: varchar("stockStatus", { length: 16 }).notNull(),
    expectedDate: varchar("expectedDate", { length: 64 }),
    url: text("url").notNull(),
    taxRate: double("taxRate"),
    fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.distributorId, table.modelNumber] }),
  ],
);

export type PriceCacheRow = typeof priceCache.$inferSelect;
export type InsertPriceCacheRow = typeof priceCache.$inferInsert;

export const priceHistory = mysqlTable(
  "price_history",
  {
    distributorId: varchar("distributorId", { length: 64 }).notNull(),
    modelNumber: varchar("modelNumber", { length: 128 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    price: double("price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    stockStatus: varchar("stockStatus", { length: 16 }).notNull(),
    fetchedAt: bigint("fetchedAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.distributorId, table.modelNumber, table.date],
    }),
  ],
);

export type PriceHistoryRow = typeof priceHistory.$inferSelect;
export type InsertPriceHistoryRow = typeof priceHistory.$inferInsert;

export const priceInsights = mysqlTable("price_insights", {
  productId: varchar("productId", { length: 128 }).notNull().primaryKey(),
  insight: text("insight").notNull(),
  generatedAt: bigint("generatedAt", { mode: "number" }).notNull(),
});

export type PriceInsightsRow = typeof priceInsights.$inferSelect;
export type InsertPriceInsightsRow = typeof priceInsights.$inferInsert;

export const productImages = mysqlTable("product_images", {
  productId: varchar("productId", { length: 128 }).notNull().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
});

export type ProductImagesRow = typeof productImages.$inferSelect;
export type InsertProductImagesRow = typeof productImages.$inferInsert;

export const deviceNotificationConfigs = mysqlTable(
  "device_notification_configs",
  {
    deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
    alerts: json("alerts"),
    stockWatches: json("stockWatches"),
    dateReminders: json("dateReminders"),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
);

export type DeviceNotificationConfigRow =
  typeof deviceNotificationConfigs.$inferSelect;
export type InsertDeviceNotificationConfigRow =
  typeof deviceNotificationConfigs.$inferInsert;

export const notificationEvents = mysqlTable(
  "notification_events",
  {
    id: varchar("id", { length: 128 }).notNull().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
    deviceId: varchar("deviceId", { length: 128 }),
    type: varchar("type", { length: 16 }).notNull(),
    dedupKey: varchar("dedupKey", { length: 255 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: json("payload"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("notif_events_user_dedup").on(table.userId, table.dedupKey),
    uniqueIndex("notif_events_device_dedup").on(
      table.deviceId,
      table.dedupKey,
    ),
    index("idx_notif_events_created").on(table.createdAt),
    index("idx_notif_events_device").on(table.deviceId),
  ],
);

export type NotificationEventRow = typeof notificationEvents.$inferSelect;
export type InsertNotificationEventRow = typeof notificationEvents.$inferInsert;

export const notificationEventDeliveries = mysqlTable(
  "notification_event_deliveries",
  {
    deviceId: varchar("deviceId", { length: 128 }).notNull(),
    eventId: varchar("eventId", { length: 128 })
      .notNull()
      .references(() => notificationEvents.id, { onDelete: "cascade" }),
    deliveredAt: bigint("deliveredAt", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.deviceId, table.eventId] })],
);

export type NotificationEventDeliveryRow =
  typeof notificationEventDeliveries.$inferSelect;
export type InsertNotificationEventDeliveryRow =
  typeof notificationEventDeliveries.$inferInsert;

export const devicePushTokens = mysqlTable("device_push_tokens", {
  deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: varchar("platform", { length: 16 }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type DevicePushTokenRow = typeof devicePushTokens.$inferSelect;
export type InsertDevicePushTokenRow = typeof devicePushTokens.$inferInsert;

export const deviceLabels = mysqlTable("device_labels", {
  deviceId: varchar("deviceId", { length: 128 }).notNull().primaryKey(),
  label: varchar("label", { length: 64 }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type DeviceLabelRow = typeof deviceLabels.$inferSelect;
export type InsertDeviceLabelRow = typeof deviceLabels.$inferInsert;

export const revokedDevices = mysqlTable(
  "revoked_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    deviceId: varchar("deviceId", { length: 128 }).notNull(),
    userId: int("userId"),
    revokedAt: bigint("revokedAt", { mode: "number" }).notNull(),
  },
  (t) => ({
    uniqUserDevice: uniqueIndex("revoked_devices_user_device").on(
      t.userId,
      t.deviceId,
    ),
  }),
);

export type RevokedDeviceRow = typeof revokedDevices.$inferSelect;
export type InsertRevokedDeviceRow = typeof revokedDevices.$inferInsert;

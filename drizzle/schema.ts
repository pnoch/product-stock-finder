import {
  bigint,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
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
    userId: int("userId").notNull().references(() => users.id),
    productId: varchar("productId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const priceAlerts = mysqlTable(
  "price_alerts",
  {
    userId: int("userId").notNull().references(() => users.id),
    alertId: varchar("alertId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.alertId] })],
);

export const backOrderReminders = mysqlTable(
  "back_order_reminders",
  {
    userId: int("userId").notNull().references(() => users.id),
    reminderId: varchar("reminderId", { length: 191 }).notNull(),
    data: json("data").notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
    deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.reminderId] })],
);

export const appSettings = mysqlTable("app_settings", {
  userId: int("userId").notNull().references(() => users.id).primaryKey(),
  data: json("data").notNull(),
  updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
  deletedAtMs: bigint("deletedAtMs", { mode: "number" }),
});

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = typeof watchlistItems.$inferInsert;
export type PriceAlertRow = typeof priceAlerts.$inferSelect;
export type InsertPriceAlertRow = typeof priceAlerts.$inferInsert;
export type BackOrderReminderRow = typeof backOrderReminders.$inferSelect;
export type InsertBackOrderReminderRow = typeof backOrderReminders.$inferInsert;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type InsertAppSettingsRow = typeof appSettings.$inferInsert;

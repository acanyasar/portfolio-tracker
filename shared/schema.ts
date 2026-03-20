import { pgTable, text, integer, real, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Widget preferences
export type WidgetId = "sectorAllocation" | "dividendIncome" | "upcomingEvents" | "performanceRanking" | "portfolioHealth" | "quickActions";
export type WidgetPreferences = Record<WidgetId, boolean>;
export const defaultWidgetPreferences: WidgetPreferences = {
  sectorAllocation: true, dividendIncome: true, upcomingEvents: true,
  performanceRanking: true, portfolioHealth: true, quickActions: true,
};

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").unique(),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dashboardWidgets: jsonb("dashboard_widgets").$type<WidgetPreferences>().notNull().default(defaultWidgetPreferences),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, dashboardWidgets: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Holdings - each stock position
export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  shares: real("shares").notNull(),
  avgCost: real("avg_cost").notNull(),
  sector: text("sector").notNull().default("Other"),
  notes: text("notes").default(""),
  purchaseDate: text("purchase_date"),  // ISO date string e.g. "2024-01-15", nullable
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({ id: true, userId: true });
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;

// Watchlist - stocks being tracked (not held)
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  alertLow: real("alert_low"),
  alertHigh: real("alert_high"),
  notes: text("notes").default(""),
  addedAt: text("added_at").notNull().default(""),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true, userId: true });
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;

// Transactions - trade history (auto-logged + manual)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),  // BUY | SELL | SELL_ALL
  shares: real("shares").notNull(),
  price: real("price").notNull(),
  totalValue: real("total_value").notNull(),
  date: text("date").notNull(),  // ISO date string
  notes: text("notes").default(""),
  realizedPnl: real("realized_pnl"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, userId: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Notifications - fired when price crosses alert threshold
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  watchlistItemId: integer("watchlist_item_id").references(() => watchlist.id),
  ticker: text("ticker").notNull(),
  type: text("type").notNull(),  // ALERT_LOW | ALERT_HIGH
  price: real("price").notNull(),
  threshold: real("threshold").notNull(),
  readAt: timestamp("read_at"),  // null = unread
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, userId: true, createdAt: true, readAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Price cache - store last fetched prices to avoid hammering the API
export const priceCache = pgTable("price_cache", {
  ticker: text("ticker").primaryKey(),
  price: real("price").notNull(),
  change: real("change").notNull().default(0),
  changePercent: real("change_percent").notNull().default(0),
  high52w: real("high_52w"),
  low52w: real("low_52w"),
  marketCap: real("market_cap"),
  volume: integer("volume"),
  fetchedAt: text("fetched_at").notNull(),
});

export const insertPriceCacheSchema = createInsertSchema(priceCache);
export type PriceCache = typeof priceCache.$inferSelect;

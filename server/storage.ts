import { eq, and, isNull, gt } from "drizzle-orm";
import {
  users, holdings, watchlist, transactions, notifications, priceCache,
  type WidgetPreferences, defaultWidgetPreferences,
  type User, type InsertUser,
  type Holding, type InsertHolding,
  type WatchlistItem, type InsertWatchlistItem,
  type Transaction, type InsertTransaction,
  type Notification, type InsertNotification,
  type PriceCache,
} from "@shared/schema";

export interface IStorage {
  // Auth
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(username: string, passwordHash: string, email?: string): Promise<User>;
  updateUserPreferences(id: number, prefs: WidgetPreferences): Promise<User | undefined>;
  // Password reset
  setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  getUserByResetToken(tokenHash: string): Promise<User | undefined>;
  clearResetToken(userId: number): Promise<void>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;

  // Holdings
  getHoldings(userId: number): Promise<Holding[]>;
  getHolding(userId: number, id: number): Promise<Holding | undefined>;
  createHolding(userId: number, data: InsertHolding): Promise<Holding>;
  updateHolding(userId: number, id: number, data: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(userId: number, id: number): Promise<boolean>;
  bulkCreateHoldings(userId: number, data: InsertHolding[]): Promise<Holding[]>;

  // Watchlist
  getWatchlist(userId: number): Promise<WatchlistItem[]>;
  getWatchlistItem(userId: number, id: number): Promise<WatchlistItem | undefined>;
  createWatchlistItem(userId: number, data: InsertWatchlistItem): Promise<WatchlistItem>;
  updateWatchlistItem(userId: number, id: number, data: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined>;
  deleteWatchlistItem(userId: number, id: number): Promise<boolean>;

  // Transactions
  getTransactions(userId: number): Promise<Transaction[]>;
  createTransaction(userId: number, data: InsertTransaction): Promise<Transaction>;

  // Notifications
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  createNotification(userId: number, data: InsertNotification): Promise<Notification>;
  markAllNotificationsRead(userId: number): Promise<void>;
  hasUnreadNotification(userId: number, ticker: string, type: string): Promise<boolean>;

  // Price cache
  getPriceCache(ticker: string): Promise<PriceCache | undefined>;
  setPriceCache(data: PriceCache): Promise<void>;
  getAllPriceCaches(): Promise<PriceCache[]>;
  clearPriceCache(): Promise<void>;
  clearPriceCacheForTickers(tickers: string[]): Promise<void>;
}

// ── In-memory storage (used when DATABASE_URL is not set) ─────────────────────

export class MemoryStorage implements IStorage {
  private usersMap: Map<number, User> = new Map();
  private holdingsMap: Map<number, Holding> = new Map();
  private watchlistMap: Map<number, WatchlistItem> = new Map();
  private transactionsMap: Map<number, Transaction> = new Map();
  private notificationsMap: Map<number, Notification> = new Map();
  private priceCacheMap: Map<string, PriceCache> = new Map();
  private userIdCounter = 1;
  private holdingIdCounter = 1;
  private watchlistIdCounter = 1;
  private transactionIdCounter = 1;
  private notificationIdCounter = 1;

  constructor() {
    // Create a default memory user (id=1)
    const defaultUser: User = { id: 1, username: "admin", passwordHash: "", email: null, resetToken: null, resetTokenExpiresAt: null, createdAt: new Date(), dashboardWidgets: defaultWidgetPreferences };
    this.usersMap.set(1, defaultUser);
    this.userIdCounter = 2;

    const uid = 1;
    const seedHoldings: InsertHolding[] = [
      { ticker: "NVDA", name: "NVIDIA Corporation",   shares: 120, avgCost: 127.83, sector: "Semiconductors",    purchaseDate: "2024-01-10" },
      { ticker: "AMD",  name: "Advanced Micro Devices", shares: 85, avgCost: 162.0, sector: "Semiconductors",    purchaseDate: "2024-02-14" },
      { ticker: "TSLA", name: "Tesla Inc.",             shares: 40, avgCost: 310.0,  sector: "Automotive/EV",     purchaseDate: "2024-03-05" },
      { ticker: "PLTR", name: "Palantir Technologies",  shares: 150, avgCost: 128.84, sector: "Software/AI",     purchaseDate: "2024-04-22" },
      { ticker: "APP",  name: "AppLovin Corporation",   shares: 30, avgCost: 310.0,  sector: "Software/AI",      purchaseDate: "2024-06-18" },
      { ticker: "CRDO", name: "Credo Technology",       shares: 110, avgCost: 55.0,  sector: "Semiconductors",   purchaseDate: "2024-07-03" },
      { ticker: "IREN", name: "IREN Limited",           shares: 180, avgCost: 47.66, sector: "Bitcoin Mining/AI", purchaseDate: "2024-08-15" },
      { ticker: "ALAB", name: "Astera Labs Inc.",       shares: 20, avgCost: 78.0,   sector: "Semiconductors",   purchaseDate: "2024-09-10" },
      { ticker: "AMZN", name: "Amazon.com Inc.",        shares: 25, avgCost: 195.0,  sector: "Cloud/E-commerce", purchaseDate: "2024-10-07" },
      { ticker: "GOOGL", name: "Alphabet Inc.",         shares: 18, avgCost: 170.0,  sector: "Cloud/AI",         purchaseDate: "2024-11-20" },
      { ticker: "CASH", name: "Cash & Equivalents",     shares: 15000, avgCost: 1.0, sector: "Cash",            purchaseDate: "2025-01-01", notes: "Dry powder" },
    ];
    for (const h of seedHoldings) {
      const id = this.holdingIdCounter++;
      this.holdingsMap.set(id, { id, userId: uid, ...h, sector: h.sector ?? "Other", notes: h.notes ?? null, purchaseDate: h.purchaseDate ?? null });
    }

    const seedWatchlist: InsertWatchlistItem[] = [
      { ticker: "CELH", name: "Celsius Holdings", alertLow: 28.0, alertHigh: 50.0, notes: "Beverage growth play", addedAt: new Date().toISOString() },
      { ticker: "IONQ", name: "IonQ Inc.", alertLow: 20.0, alertHigh: 45.0, notes: "Quantum computing - speculative", addedAt: new Date().toISOString() },
      { ticker: "ASTS", name: "AST SpaceMobile", alertLow: 18.0, alertHigh: 35.0, notes: "Space broadband - wait for pull-back", addedAt: new Date().toISOString() },
    ];
    for (const w of seedWatchlist) {
      const id = this.watchlistIdCounter++;
      this.watchlistMap.set(id, { id, userId: uid, ...w, notes: w.notes ?? null, alertLow: w.alertLow ?? null, alertHigh: w.alertHigh ?? null, addedAt: w.addedAt ?? "" });
    }
  }

  // Auth
  async getUserById(id: number): Promise<User | undefined> { return this.usersMap.get(id); }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(u => u.username === username);
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(u => u.email === email);
  }
  async createUser(username: string, passwordHash: string, email?: string): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { id, username, passwordHash, email: email ?? null, resetToken: null, resetTokenExpiresAt: null, createdAt: new Date(), dashboardWidgets: defaultWidgetPreferences };
    this.usersMap.set(id, user);
    return user;
  }
  async setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const user = this.usersMap.get(userId);
    if (user) this.usersMap.set(userId, { ...user, resetToken: tokenHash, resetTokenExpiresAt: expiresAt });
  }
  async getUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const now = new Date();
    return Array.from(this.usersMap.values()).find(
      u => u.resetToken === tokenHash && u.resetTokenExpiresAt != null && u.resetTokenExpiresAt > now
    );
  }
  async clearResetToken(userId: number): Promise<void> {
    const user = this.usersMap.get(userId);
    if (user) this.usersMap.set(userId, { ...user, resetToken: null, resetTokenExpiresAt: null });
  }
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const user = this.usersMap.get(userId);
    if (user) this.usersMap.set(userId, { ...user, passwordHash });
  }
  async updateUserPreferences(id: number, prefs: WidgetPreferences): Promise<User | undefined> {
    const user = this.usersMap.get(id);
    if (!user) return undefined;
    const updated = { ...user, dashboardWidgets: prefs };
    this.usersMap.set(id, updated);
    return updated;
  }

  // Holdings
  async getHoldings(userId: number): Promise<Holding[]> {
    return Array.from(this.holdingsMap.values()).filter(h => h.userId === userId);
  }
  async getHolding(userId: number, id: number): Promise<Holding | undefined> {
    const h = this.holdingsMap.get(id);
    return h?.userId === userId ? h : undefined;
  }
  async createHolding(userId: number, data: InsertHolding): Promise<Holding> {
    const id = this.holdingIdCounter++;
    const holding: Holding = { id, userId, ...data, sector: data.sector ?? "Other", notes: data.notes ?? null, purchaseDate: data.purchaseDate ?? null };
    this.holdingsMap.set(id, holding);
    return holding;
  }
  async updateHolding(userId: number, id: number, data: Partial<InsertHolding>): Promise<Holding | undefined> {
    const existing = this.holdingsMap.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated = { ...existing, ...data };
    this.holdingsMap.set(id, updated);
    return updated;
  }
  async deleteHolding(userId: number, id: number): Promise<boolean> {
    const h = this.holdingsMap.get(id);
    if (!h || h.userId !== userId) return false;
    return this.holdingsMap.delete(id);
  }
  async bulkCreateHoldings(userId: number, data: InsertHolding[]): Promise<Holding[]> {
    const results: Holding[] = [];
    for (const item of data) results.push(await this.createHolding(userId, item));
    return results;
  }

  // Watchlist
  async getWatchlist(userId: number): Promise<WatchlistItem[]> {
    return Array.from(this.watchlistMap.values()).filter(w => w.userId === userId);
  }
  async getWatchlistItem(userId: number, id: number): Promise<WatchlistItem | undefined> {
    const w = this.watchlistMap.get(id);
    return w?.userId === userId ? w : undefined;
  }
  async createWatchlistItem(userId: number, data: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.watchlistIdCounter++;
    const item: WatchlistItem = { id, userId, ...data, notes: data.notes ?? null, alertLow: data.alertLow ?? null, alertHigh: data.alertHigh ?? null, addedAt: data.addedAt ?? "" };
    this.watchlistMap.set(id, item);
    return item;
  }
  async updateWatchlistItem(userId: number, id: number, data: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined> {
    const existing = this.watchlistMap.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated = { ...existing, ...data };
    this.watchlistMap.set(id, updated);
    return updated;
  }
  async deleteWatchlistItem(userId: number, id: number): Promise<boolean> {
    const w = this.watchlistMap.get(id);
    if (!w || w.userId !== userId) return false;
    return this.watchlistMap.delete(id);
  }

  // Transactions
  async getTransactions(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactionsMap.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createTransaction(userId: number, data: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const tx: Transaction = { id, userId, ...data, notes: data.notes ?? "", createdAt: new Date() };
    this.transactionsMap.set(id, tx);
    return tx;
  }

  // Notifications
  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notificationsMap.values())
      .filter(n => n.userId === userId && n.readAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createNotification(userId: number, data: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const n: Notification = { id, userId, ...data, watchlistItemId: data.watchlistItemId ?? null, readAt: null, createdAt: new Date() };
    this.notificationsMap.set(id, n);
    return n;
  }
  async markAllNotificationsRead(userId: number): Promise<void> {
    const now = new Date();
    for (const [k, n] of Array.from(this.notificationsMap.entries())) {
      if (n.userId === userId && n.readAt === null) {
        this.notificationsMap.set(k, { ...n, readAt: now });
      }
    }
  }
  async hasUnreadNotification(userId: number, ticker: string, type: string): Promise<boolean> {
    return Array.from(this.notificationsMap.values()).some(
      n => n.userId === userId && n.ticker === ticker && n.type === type && n.readAt === null
    );
  }

  // Price cache
  async getPriceCache(ticker: string): Promise<PriceCache | undefined> {
    return this.priceCacheMap.get(ticker.toUpperCase());
  }
  async setPriceCache(data: PriceCache): Promise<void> {
    this.priceCacheMap.set(data.ticker.toUpperCase(), data);
  }
  async getAllPriceCaches(): Promise<PriceCache[]> {
    return Array.from(this.priceCacheMap.values());
  }
  async clearPriceCache(): Promise<void> {
    this.priceCacheMap.clear();
  }
  async clearPriceCacheForTickers(tickers: string[]): Promise<void> {
    for (const t of tickers) this.priceCacheMap.delete(t.toUpperCase());
  }
}

// ── Database storage ──────────────────────────────────────────────────────────

export class DatabaseStorage implements IStorage {
  // Auth
  async getUserById(id: number): Promise<User | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0];
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }
  async createUser(username: string, passwordHash: string, email?: string): Promise<User> {
    const { db } = await import("./db");
    const rows = await db.insert(users).values({ username, passwordHash, email: email ?? null }).returning();
    return rows[0];
  }
  async setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const { db } = await import("./db");
    await db.update(users).set({ resetToken: tokenHash, resetTokenExpiresAt: expiresAt }).where(eq(users.id, userId));
  }
  async getUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(users).where(
      and(eq(users.resetToken, tokenHash), gt(users.resetTokenExpiresAt, new Date()))
    );
    return rows[0];
  }
  async clearResetToken(userId: number): Promise<void> {
    const { db } = await import("./db");
    await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null }).where(eq(users.id, userId));
  }
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    const { db } = await import("./db");
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }
  async updateUserPreferences(id: number, prefs: WidgetPreferences): Promise<User | undefined> {
    const { db } = await import("./db");
    const rows = await db.update(users).set({ dashboardWidgets: prefs }).where(eq(users.id, id)).returning();
    return rows[0];
  }

  // Holdings
  async getHoldings(userId: number): Promise<Holding[]> {
    const { db } = await import("./db");
    return db.select().from(holdings).where(eq(holdings.userId, userId));
  }
  async getHolding(userId: number, id: number): Promise<Holding | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
    return rows[0];
  }
  async createHolding(userId: number, data: InsertHolding): Promise<Holding> {
    const { db } = await import("./db");
    const rows = await db.insert(holdings).values({ ...data, userId }).returning();
    return rows[0];
  }
  async updateHolding(userId: number, id: number, data: Partial<InsertHolding>): Promise<Holding | undefined> {
    const { db } = await import("./db");
    const rows = await db.update(holdings).set(data).where(and(eq(holdings.id, id), eq(holdings.userId, userId))).returning();
    return rows[0];
  }
  async deleteHolding(userId: number, id: number): Promise<boolean> {
    const { db } = await import("./db");
    const rows = await db.delete(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId))).returning({ id: holdings.id });
    return rows.length > 0;
  }
  async bulkCreateHoldings(userId: number, data: InsertHolding[]): Promise<Holding[]> {
    const { db } = await import("./db");
    return db.insert(holdings).values(data.map(d => ({ ...d, userId }))).returning();
  }

  // Watchlist
  async getWatchlist(userId: number): Promise<WatchlistItem[]> {
    const { db } = await import("./db");
    return db.select().from(watchlist).where(eq(watchlist.userId, userId));
  }
  async getWatchlistItem(userId: number, id: number): Promise<WatchlistItem | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
    return rows[0];
  }
  async createWatchlistItem(userId: number, data: InsertWatchlistItem): Promise<WatchlistItem> {
    const { db } = await import("./db");
    const rows = await db.insert(watchlist).values({ ...data, userId }).returning();
    return rows[0];
  }
  async updateWatchlistItem(userId: number, id: number, data: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined> {
    const { db } = await import("./db");
    const rows = await db.update(watchlist).set(data).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId))).returning();
    return rows[0];
  }
  async deleteWatchlistItem(userId: number, id: number): Promise<boolean> {
    const { db } = await import("./db");
    const rows = await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId))).returning({ id: watchlist.id });
    return rows.length > 0;
  }

  // Transactions
  async getTransactions(userId: number): Promise<Transaction[]> {
    const { db } = await import("./db");
    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createTransaction(userId: number, data: InsertTransaction): Promise<Transaction> {
    const { db } = await import("./db");
    const rows = await db.insert(transactions).values({ ...data, userId }).returning();
    return rows[0];
  }

  // Notifications
  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    const { db } = await import("./db");
    const rows = await db.select().from(notifications).where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt))
    );
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createNotification(userId: number, data: InsertNotification): Promise<Notification> {
    const { db } = await import("./db");
    const rows = await db.insert(notifications).values({ ...data, userId }).returning();
    return rows[0];
  }
  async markAllNotificationsRead(userId: number): Promise<void> {
    const { db } = await import("./db");
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
  async hasUnreadNotification(userId: number, ticker: string, type: string): Promise<boolean> {
    const { db } = await import("./db");
    const rows = await db.select().from(notifications).where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.ticker, ticker),
        eq(notifications.type, type),
        isNull(notifications.readAt)
      )
    );
    return rows.length > 0;
  }

  // Price cache
  async getPriceCache(ticker: string): Promise<PriceCache | undefined> {
    const { db } = await import("./db");
    const rows = await db.select().from(priceCache).where(eq(priceCache.ticker, ticker.toUpperCase()));
    return rows[0];
  }
  async setPriceCache(data: PriceCache): Promise<void> {
    const { db } = await import("./db");
    await db.insert(priceCache).values(data).onConflictDoUpdate({
      target: priceCache.ticker,
      set: {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        high52w: data.high52w,
        low52w: data.low52w,
        marketCap: data.marketCap,
        volume: data.volume,
        fetchedAt: data.fetchedAt,
      },
    });
  }
  async getAllPriceCaches(): Promise<PriceCache[]> {
    const { db } = await import("./db");
    return db.select().from(priceCache);
  }
  async clearPriceCache(): Promise<void> {
    const { db } = await import("./db");
    await db.delete(priceCache);
  }
  async clearPriceCacheForTickers(tickers: string[]): Promise<void> {
    if (tickers.length === 0) return;
    const { db } = await import("./db");
    const { inArray } = await import("drizzle-orm");
    await db.delete(priceCache).where(inArray(priceCache.ticker, tickers.map(t => t.toUpperCase())));
  }
}

export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemoryStorage();

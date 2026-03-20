import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { storage } from "./storage";
import { sendPasswordResetEmail } from "./email";
import { insertHoldingSchema, insertWatchlistSchema, insertTransactionSchema, defaultWidgetPreferences } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import { getPrice, fetchYahooPrice } from "./priceService";

// Sector mapping from Yahoo Finance industry/sector strings
function mapYahooSectorToAppSector(yahooSector?: string, yahooIndustry?: string): string {
  const s = (yahooSector ?? "").toLowerCase();
  const ind = (yahooIndustry ?? "").toLowerCase();
  if (s.includes("technology") || ind.includes("semiconductor")) {
    if (ind.includes("semiconductor")) return "Semiconductors";
    if (ind.includes("software") || ind.includes("application")) return "Software/AI";
    if (ind.includes("internet") || ind.includes("cloud") || ind.includes("data")) return "Cloud/AI";
    return "Software/AI";
  }
  if (s.includes("communication")) return "Cloud/AI";
  if (ind.includes("electric vehicle") || ind.includes("auto")) return "Automotive/EV";
  if (ind.includes("bitcoin") || ind.includes("crypto") || ind.includes("mining")) return "Bitcoin Mining/AI";
  if (s.includes("healthcare") || s.includes("biotechnology")) return "Biotech";
  if (s.includes("energy") || s.includes("utilities")) return "Energy";
  if (s.includes("financial") || ind.includes("bank") || ind.includes("insurance")) return "Finance";
  if (s.includes("consumer")) return "Consumer";
  if (s.includes("industrials") || s.includes("industrial")) return "Industrial";
  if (s.includes("real estate")) return "Real Estate";
  return "Other";
}

async function fetchYahooQuoteSummary(ticker: string): Promise<{
  name: string; sector: string; price: number;
} | null> {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!chartRes.ok) return null;
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const name = meta.shortName ?? meta.longName ?? ticker;
    const price = meta.regularMarketPrice ?? 0;

    let sector = "Other";
    try {
      const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=assetProfile`;
      const summaryRes = await fetch(summaryUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const profile = summaryData?.quoteSummary?.result?.[0]?.assetProfile;
        if (profile) {
          sector = mapYahooSectorToAppSector(profile.sector, profile.industry);
        }
      }
    } catch { /* sector stays "Other" */ }

    if (sector === "Other") {
      const knownSectors: Record<string, string> = {
        NVDA: "Semiconductors", AMD: "Semiconductors", INTC: "Semiconductors",
        TSM: "Semiconductors", ALAB: "Semiconductors", CRDO: "Semiconductors",
        AVGO: "Semiconductors", QCOM: "Semiconductors", ARM: "Semiconductors",
        AAPL: "Software/AI", MSFT: "Software/AI", GOOGL: "Cloud/AI",
        GOOG: "Cloud/AI", META: "Cloud/AI", AMZN: "Cloud/E-commerce",
        TSLA: "Automotive/EV", RIVN: "Automotive/EV", NIO: "Automotive/EV",
        PLTR: "Software/AI", APP: "Software/AI", SNOW: "Cloud/AI",
        CRM: "Software/AI", ADBE: "Software/AI", ORCL: "Cloud/AI",
        MSTR: "Bitcoin Mining/AI", IREN: "Bitcoin Mining/AI", MARA: "Bitcoin Mining/AI",
        RIOT: "Bitcoin Mining/AI", CLSK: "Bitcoin Mining/AI",
        IONQ: "Software/AI", ASTS: "Software/AI",
        SOFI: "Finance", JPM: "Finance", BAC: "Finance", GS: "Finance",
        CELH: "Consumer", MNST: "Consumer",
        VST: "Energy", NEE: "Energy",
        RKLB: "Industrial", SPCE: "Industrial",
      };
      sector = knownSectors[ticker.toUpperCase()] ?? "Other";
    }

    return { name, sector, price };
  } catch {
    return null;
  }
}

async function fetchYahooDividends(ticker: string): Promise<{
  dividendRate: number;
  dividendYield: number;
  exDividendDate: string | null;
  nextPaymentDate: string | null;
  payoutFrequency: number;
  lastDividendValue: number;
  nextPaymentAmount: number;
} | null> {
  try {
    // Use v8 chart API with dividend events — works without a crumb/cookie.
    // Extend period2 one year forward so projected future payments are included.
    const nowSec = Math.floor(Date.now() / 1000);
    const twoYearsAgo = nowSec - 2 * 365 * 24 * 60 * 60;
    const oneYearForward = nowSec + 365 * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?period1=${twoYearsAgo}&period2=${oneYearForward}&interval=1mo&events=dividends`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const divEvents = data?.chart?.result?.[0]?.events?.dividends;
    if (!meta) return null;

    // No dividend events → not a dividend payer
    if (!divEvents || Object.keys(divEvents).length === 0) return null;

    const allDivs = (Object.values(divEvents) as Array<{ amount: number; date: number }>)
      .sort((a, b) => a.date - b.date);

    const pastDivs   = allDivs.filter(d => d.date <= nowSec);
    const futureDivs = allDivs.filter(d => d.date > nowSec);

    // Annual rate: sum of dividends paid in the last 12 months
    const oneYearAgo = nowSec - 365 * 24 * 60 * 60;
    const lastYearDivs = pastDivs.filter(d => d.date > oneYearAgo);
    const dividendRate = lastYearDivs.reduce((s, d) => s + d.amount, 0);

    // Infer payout frequency from payments per year (clamp 1–12)
    const payoutFrequency = lastYearDivs.length > 0
      ? Math.max(1, Math.min(12, lastYearDivs.length))
      : 4;

    const currentPrice = meta.regularMarketPrice ?? 1;
    const dividendYield = currentPrice > 0 ? dividendRate / currentPrice : 0;

    // Most recent past payment (skip any $0 entries that are data artefacts)
    const positivePastDivs = pastDivs.filter(d => d.amount > 0);
    const lastDividendValue = positivePastDivs.length > 0
      ? positivePastDivs[positivePastDivs.length - 1].amount
      : 0;

    // Ex-dividend date ≈ date of last past payment
    const exDividendDate = pastDivs.length > 0
      ? new Date(pastDivs[pastDivs.length - 1].date * 1000).toISOString().split("T")[0]
      : null;

    // Next payment date: use first projected future dividend if available,
    // otherwise estimate from last payment + payout interval.
    let nextPaymentDate: string | null = null;
    if (futureDivs.length > 0) {
      nextPaymentDate = new Date(futureDivs[0].date * 1000).toISOString().split("T")[0];
    } else if (pastDivs.length > 0) {
      const lastPaymentSec = pastDivs[pastDivs.length - 1].date;
      const intervalDays = Math.round(365 / payoutFrequency);
      // Advance from last payment date until we land in the future
      let nextSec = lastPaymentSec + intervalDays * 24 * 60 * 60;
      while (nextSec <= nowSec) nextSec += intervalDays * 24 * 60 * 60;
      nextPaymentDate = new Date(nextSec * 1000).toISOString().split("T")[0];
    }

    // Amount for the specific next payment: prefer the projected future event's amount,
    // fall back to the last past dividend amount.
    const nextPaymentAmount = futureDivs.length > 0 && futureDivs[0].amount > 0
      ? futureDivs[0].amount
      : lastDividendValue;

    return { dividendRate, dividendYield, exDividendDate, nextPaymentDate, payoutFrequency, lastDividendValue, nextPaymentAmount };
  } catch {
    return null;
  }
}

async function fetchDividendHistory5yr(ticker: string): Promise<{
  cagr1yr: number | null;
  cagr3yr: number | null;
  cagr5yr: number | null;
  streak: number;
  annualDps: Array<{ year: number; dps: number }>;
} | null> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const threeYearsAgo = nowSec - 3 * 365 * 24 * 60 * 60;
    const sixYearsAgo = nowSec - 6 * 365 * 24 * 60 * 60;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    };
    const buildUrl = (p1: number, p2: number) =>
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?period1=${p1}&period2=${p2}&interval=1mo&events=dividends`;

    // Two parallel 3-year fetches — a single 6-year fetch with interval=1mo
    // is silently truncated by Yahoo Finance, so we split and merge.
    const [recentRes, olderRes] = await Promise.all([
      fetch(buildUrl(threeYearsAgo, nowSec), { headers }),
      fetch(buildUrl(sixYearsAgo, threeYearsAgo), { headers }),
    ]);

    const recentData = recentRes.ok ? await recentRes.json() : null;
    const olderData = olderRes.ok ? await olderRes.json() : null;

    const recentDivs = recentData?.chart?.result?.[0]?.events?.dividends ?? {};
    const olderDivs = olderData?.chart?.result?.[0]?.events?.dividends ?? {};
    const divEvents = { ...olderDivs, ...recentDivs };

    if (Object.keys(divEvents).length === 0) return null;

    // Group dividends by calendar year
    const byYear: Record<number, number> = {};
    for (const div of Object.values(divEvents) as Array<{ amount: number; date: number }>) {
      if (div.amount <= 0) continue;
      const year = new Date(div.date * 1000).getFullYear();
      byYear[year] = (byYear[year] ?? 0) + div.amount;
    }

    const currentYear = new Date().getFullYear();
    // Use the last complete calendar year as the reference point
    const latestYear = currentYear - 1;

    // Build sparkline data for last 5 complete years
    const annualDps: Array<{ year: number; dps: number }> = [];
    for (let y = latestYear - 4; y <= latestYear; y++) {
      if (byYear[y] != null) annualDps.push({ year: y, dps: byYear[y] });
    }

    const computeCagr = (startYear: number, endYear: number): number | null => {
      const start = byYear[startYear];
      const end = byYear[endYear];
      if (!start || !end || start <= 0) return null;
      const n = endYear - startYear;
      return n > 0 ? Math.pow(end / start, 1 / n) - 1 : null;
    };

    const cagr1yr = computeCagr(latestYear - 1, latestYear);
    const cagr3yr = computeCagr(latestYear - 3, latestYear);
    const cagr5yr = computeCagr(latestYear - 5, latestYear);

    // Count consecutive years of dividend increases, starting from the last COMPLETE
    // calendar year. The current year is always incomplete (partial payments), so
    // starting from sortedYears[0] would compare a partial year against a full year
    // and always break the streak at 0.
    let streak = 0;
    let checkYear = latestYear;
    while (byYear[checkYear] != null && byYear[checkYear - 1] != null) {
      if (byYear[checkYear] > byYear[checkYear - 1]) {
        streak++;
        checkYear--;
      } else {
        break;
      }
    }

    return { cagr1yr, cagr3yr, cagr5yr, streak, annualDps };
  } catch {
    return null;
  }
}

async function fetchHistoricalPrices(ticker: string, range = "1y"): Promise<Array<{ date: string; close: number }>> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=${range}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().split("T")[0], close: closes[i] }))
      .filter(d => d.close != null && !isNaN(d.close));
  } catch {
    return [];
  }
}

export async function registerRoutes(httpServer: Server, app: Express) {
  // ── Auth routes (unprotected) ──────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, email } = req.body ?? {};
    if (!username || !password) return res.status(400).json({ error: "username and password required" });
    if (typeof username !== "string" || username.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(409).json({ error: "Username already taken" });
    if (email && typeof email === "string") {
      const emailTaken = await storage.getUserByEmail(email);
      if (emailTaken) return res.status(409).json({ error: "Email already in use" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await storage.createUser(username, passwordHash, email || undefined);
    req.login({ id: user.id, username: user.username }, (err) => {
      if (err) return res.status(500).json({ error: "Login failed after register" });
      return res.status(201).json({ id: user.id, username: user.username });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body ?? {};
    // Always return 200 to prevent email enumeration
    if (!email || typeof email !== "string") return res.status(200).json({ ok: true });
    const user = await storage.getUserByEmail(email);
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.setResetToken(user.id, tokenHash, expiresAt);
      const appUrl = process.env.APP_URL ?? "http://localhost:3001";
      const resetUrl = `${appUrl}/#/reset-password/${rawToken}`;
      sendPasswordResetEmail(email, resetUrl).catch(err =>
        console.error("[email] Failed to send password reset email:", err)
      );
    }
    return res.status(200).json({ ok: true });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword || typeof token !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: "token and newPassword required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await storage.getUserByResetToken(tokenHash);
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await storage.updatePassword(user.id, passwordHash);
    await storage.clearResetToken(user.id);
    return res.status(200).json({ ok: true });
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message ?? "Invalid credentials" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ id: user.id, username: user.username });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(204).end();
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const user = req.user as User;
    res.json({ id: user.id, username: user.username });
  });

  // ── Ticker lookup ──────────────────────────────────────────────

  app.get("/api/lookup/:ticker", async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    if (ticker.length < 1) return res.status(400).json({ error: "ticker required" });
    const data = await fetchYahooQuoteSummary(ticker);
    if (!data) return res.status(404).json({ error: "Ticker not found" });
    res.json(data);
  });

  // ── User preferences ──────────────────────────────────────────

  app.get("/api/user/preferences", (req, res) => {
    const user = req.user as User;
    res.json(user.dashboardWidgets ?? defaultWidgetPreferences);
  });

  app.patch("/api/user/preferences", async (req, res) => {
    const userId = (req.user as User).id;
    const validKeys: Array<keyof typeof defaultWidgetPreferences> = [
      "sectorAllocation", "dividendIncome", "upcomingEvents",
      "performanceRanking", "portfolioHealth", "quickActions",
    ];
    const current = (req.user as User).dashboardWidgets ?? defaultWidgetPreferences;
    const updates: Partial<typeof defaultWidgetPreferences> = {};
    for (const key of validKeys) {
      if (typeof req.body[key] === "boolean") updates[key] = req.body[key];
    }
    const updated = await storage.updateUserPreferences(userId, { ...current, ...updates });
    res.json(updated?.dashboardWidgets ?? current);
  });

  // ── Holdings ──────────────────────────────────────────────────

  app.get("/api/holdings", async (req, res) => {
    const userId = (req.user as User).id;
    const data = await storage.getHoldings(userId);
    res.json(data);
  });

  app.post("/api/holdings", async (req, res) => {
    const userId = (req.user as User).id;
    const parsed = insertHoldingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const incoming = parsed.data;
    const existing = (await storage.getHoldings(userId)).find(
      h => h.ticker.toUpperCase() === incoming.ticker.toUpperCase()
    );

    if (existing) {
      const totalShares = existing.shares + incoming.shares;
      const newAvgCost = incoming.ticker.toUpperCase() === "CASH"
        ? 1
        : (existing.shares * existing.avgCost + incoming.shares * incoming.avgCost) / totalShares;
      const updated = await storage.updateHolding(userId, existing.id, {
        shares: totalShares,
        avgCost: newAvgCost,
      });
      // Log BUY transaction for additional shares
      if (incoming.ticker.toUpperCase() !== "CASH") {
        await storage.createTransaction(userId, {
          ticker: incoming.ticker.toUpperCase(),
          name: existing.name,
          type: "BUY",
          shares: incoming.shares,
          price: incoming.avgCost,
          totalValue: incoming.shares * incoming.avgCost,
          date: incoming.purchaseDate ?? new Date().toISOString().split("T")[0],
          notes: incoming.notes ?? "",
        });
      }
      return res.status(200).json(updated);
    }

    const holding = await storage.createHolding(userId, incoming);
    // Log BUY transaction
    if (incoming.ticker.toUpperCase() !== "CASH") {
      await storage.createTransaction(userId, {
        ticker: incoming.ticker.toUpperCase(),
        name: incoming.name,
        type: "BUY",
        shares: incoming.shares,
        price: incoming.avgCost,
        totalValue: incoming.shares * incoming.avgCost,
        date: incoming.purchaseDate ?? new Date().toISOString().split("T")[0],
        notes: incoming.notes ?? "",
      });
    }
    res.status(201).json(holding);
  });

  app.put("/api/holdings/:id", async (req, res) => {
    const userId = (req.user as User).id;
    const id = parseInt(req.params.id);
    const parsed = insertHoldingSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const existing = await storage.getHolding(userId, id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updated = await storage.updateHolding(userId, id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Not found" });

    // Auto-log if shares changed and not CASH
    if (parsed.data.shares !== undefined && existing.ticker !== "CASH" && parsed.data.shares !== existing.shares) {
      const diff = parsed.data.shares - existing.shares;
      const price = parsed.data.avgCost ?? existing.avgCost;
      if (diff > 0) {
        await storage.createTransaction(userId, {
          ticker: existing.ticker,
          name: existing.name,
          type: "BUY",
          shares: diff,
          price,
          totalValue: diff * price,
          date: new Date().toISOString().split("T")[0],
          notes: "",
        });
      } else {
        await storage.createTransaction(userId, {
          ticker: existing.ticker,
          name: existing.name,
          type: "SELL",
          shares: Math.abs(diff),
          price,
          totalValue: Math.abs(diff) * price,
          date: new Date().toISOString().split("T")[0],
          notes: "",
          realizedPnl: (price - existing.avgCost) * Math.abs(diff),
        });
      }
    }

    res.json(updated);
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    const userId = (req.user as User).id;
    const id = parseInt(req.params.id);
    const existing = await storage.getHolding(userId, id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    // Log SELL_ALL before deleting (use cached price if available)
    if (existing.ticker !== "CASH") {
      const priceData = await getPrice(existing.ticker, storage);
      const sellPrice = priceData?.price ?? existing.avgCost;
      await storage.createTransaction(userId, {
        ticker: existing.ticker,
        name: existing.name,
        type: "SELL_ALL",
        shares: existing.shares,
        price: sellPrice,
        totalValue: existing.shares * sellPrice,
        date: new Date().toISOString().split("T")[0],
        notes: "",
        realizedPnl: (sellPrice - existing.avgCost) * existing.shares,
      });
    }

    const ok = await storage.deleteHolding(userId, id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  // CSV import
  app.post("/api/holdings/import", async (req, res) => {
    const userId = (req.user as User).id;
    const rows = req.body as Array<{
      ticker: string; name: string; shares: number; avgCost: number; sector?: string; notes?: string; purchaseDate?: string;
    }>;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "Expected array" });
    const parsed = rows.map(r => insertHoldingSchema.parse({
      ticker: r.ticker?.toUpperCase(),
      name: r.name || r.ticker,
      shares: parseFloat(String(r.shares)),
      avgCost: parseFloat(String(r.avgCost)),
      sector: r.sector || "Other",
      notes: r.notes || "",
      purchaseDate: r.purchaseDate || null,
    }));
    const created = await storage.bulkCreateHoldings(userId, parsed);
    res.status(201).json(created);
  });

  // ── Watchlist ─────────────────────────────────────────────────

  app.get("/api/watchlist", async (req, res) => {
    const userId = (req.user as User).id;
    const data = await storage.getWatchlist(userId);
    res.json(data);
  });

  app.post("/api/watchlist", async (req, res) => {
    const userId = (req.user as User).id;
    const body = { ...req.body, addedAt: new Date().toISOString() };
    const parsed = insertWatchlistSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const item = await storage.createWatchlistItem(userId, parsed.data);
    res.status(201).json(item);
  });

  app.put("/api/watchlist/:id", async (req, res) => {
    const userId = (req.user as User).id;
    const id = parseInt(req.params.id);
    const parsed = insertWatchlistSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const updated = await storage.updateWatchlistItem(userId, id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    const userId = (req.user as User).id;
    const id = parseInt(req.params.id);
    const ok = await storage.deleteWatchlistItem(userId, id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  // ── Transactions ──────────────────────────────────────────────

  app.get("/api/transactions", async (req, res) => {
    const userId = (req.user as User).id;
    const data = await storage.getTransactions(userId);
    res.json(data);
  });

  app.post("/api/transactions", async (req, res) => {
    const userId = (req.user as User).id;
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { ticker, name, type, shares, price } = parsed.data;
    const upperTicker = ticker.toUpperCase();

    // Apply transaction to holdings
    const allHoldings = await storage.getHoldings(userId);
    const existing = allHoldings.find(h => h.ticker.toUpperCase() === upperTicker);

    if (type === "BUY") {
      if (existing) {
        const totalShares = existing.shares + shares;
        const newAvgCost = (existing.shares * existing.avgCost + shares * price) / totalShares;
        await storage.updateHolding(userId, existing.id, { shares: totalShares, avgCost: newAvgCost });
      } else {
        await storage.createHolding(userId, {
          ticker: upperTicker,
          name,
          shares,
          avgCost: price,
          sector: "Other",
          purchaseDate: parsed.data.date,
          notes: parsed.data.notes ?? "",
        });
      }
    } else if (type === "SELL" || type === "SELL_ALL") {
      if (existing) {
        const remainingShares = type === "SELL_ALL" ? 0 : existing.shares - shares;
        if (remainingShares <= 0) {
          await storage.deleteHolding(userId, existing.id);
        } else {
          await storage.updateHolding(userId, existing.id, { shares: remainingShares });
        }
      }
    }

    let realizedPnl: number | null = null;
    if ((type === "SELL" || type === "SELL_ALL") && existing) {
      realizedPnl = (price - existing.avgCost) * shares;
    }
    const tx = await storage.createTransaction(userId, { ...parsed.data, realizedPnl });
    res.status(201).json(tx);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    const userId = (req.user as User).id;
    const id = parseInt(req.params.id);
    const tx = await storage.getTransactionById(userId, id);
    if (!tx) return res.status(404).json({ error: "Not found" });

    const allHoldings = await storage.getHoldings(userId);
    const holding = allHoldings.find(h => h.ticker.toUpperCase() === tx.ticker.toUpperCase());

    if (tx.type === "BUY") {
      if (holding) {
        const newShares = holding.shares - tx.shares;
        if (newShares <= 0) {
          await storage.deleteHolding(userId, holding.id);
        } else {
          // Reverse the weighted average: recover cost basis before this buy
          const newAvgCost = (holding.shares * holding.avgCost - tx.shares * tx.price) / newShares;
          await storage.updateHolding(userId, holding.id, { shares: newShares, avgCost: Math.max(newAvgCost, 0) });
        }
      }
    } else if (tx.type === "SELL" || tx.type === "SELL_ALL") {
      // Recover avgCost from realizedPnl if available, otherwise fall back to sell price
      const recoveredAvgCost = tx.realizedPnl != null
        ? tx.price - (tx.realizedPnl / tx.shares)
        : tx.price;
      if (holding) {
        // Partial sell was reversed — add shares back (avgCost unchanged on sells)
        await storage.updateHolding(userId, holding.id, { shares: holding.shares + tx.shares });
      } else {
        // Holding was fully sold — recreate it
        await storage.createHolding(userId, {
          ticker: tx.ticker.toUpperCase(),
          name: tx.name,
          shares: tx.shares,
          avgCost: recoveredAvgCost,
          sector: "Other",
          notes: "",
        });
      }
    }

    await storage.deleteTransaction(userId, id);
    res.status(204).end();
  });

  // ── Notifications ─────────────────────────────────────────────

  app.get("/api/notifications", async (req, res) => {
    const userId = (req.user as User).id;
    const data = await storage.getUnreadNotifications(userId);
    res.json(data);
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    const userId = (req.user as User).id;
    await storage.markAllNotificationsRead(userId);
    res.status(204).end();
  });

  // ── Price data ────────────────────────────────────────────────

  app.get("/api/prices/:ticker", async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const data = await getPrice(ticker, storage);
    if (!data) return res.status(404).json({ error: "Price not found" });
    res.json(data);
  });

  app.get("/api/prices/:ticker/history", async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
    }
    try {
      // Fetch a ±7-day window around the target date to find nearest trading day
      const targetMs = new Date(dateStr + "T12:00:00Z").getTime();
      const period1 = Math.floor((targetMs - 7 * 24 * 60 * 60 * 1000) / 1000);
      const period2 = Math.floor((targetMs + 7 * 24 * 60 * 60 * 1000) / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?period1=${period1}&period2=${period2}&interval=1d`;
      const yRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });
      if (!yRes.ok) return res.status(404).json({ error: "Price not found" });
      const data = await yRes.json();
      const result = data?.chart?.result?.[0];
      if (!result) return res.status(404).json({ error: "Price not found" });
      const timestamps: number[] = result.timestamp ?? [];
      const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
      const points = timestamps
        .map((ts, i) => ({ ts, close: closes[i] }))
        .filter(p => p.close != null && !isNaN(p.close));
      if (points.length === 0) return res.status(404).json({ error: "Price not found" });
      // Find the point with the closest timestamp to the target date
      const targetSec = targetMs / 1000;
      const closest = points.reduce((best, p) =>
        Math.abs(p.ts - targetSec) < Math.abs(best.ts - targetSec) ? p : best
      );
      res.json({ price: parseFloat(closest.close.toFixed(2)) });
    } catch {
      res.status(500).json({ error: "Failed to fetch historical price" });
    }
  });

  app.post("/api/prices/invalidate", async (req, res) => {
    const userId = (req.user as User).id;
    const holdings = await storage.getHoldings(userId);
    const tickers = holdings.map(h => h.ticker);
    await storage.clearPriceCacheForTickers(tickers);
    res.status(204).end();
  });

  // In-memory chart cache: 15-minute TTL so repeated page loads don't hammer Yahoo
  const chartCache = new Map<string, { data: number[]; expiresAt: number }>();
  const CHART_TTL = 15 * 60 * 1000;

  // Returns ~30 daily close prices per ticker for sparkline charts
  app.post("/api/prices/charts", async (req, res) => {
    const tickers: string[] = req.body?.tickers ?? [];
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: "tickers array required" });
    }
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    };
    const now = Date.now();
    const results: Record<string, number[]> = {};
    await Promise.all(
      tickers.map(async (ticker) => {
        const key = ticker.toUpperCase();
        const cached = chartCache.get(key);
        if (cached && cached.expiresAt > now) {
          results[key] = cached.data;
          return;
        }
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(key)}?interval=1d&range=1mo`;
          const r = await fetch(url, { headers });
          if (!r.ok) return;
          const json = await r.json();
          const closes: number[] | undefined = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
          if (!closes) return;
          const clean = closes.filter((v): v is number => v != null && isFinite(v)).slice(-30);
          if (clean.length >= 2) {
            chartCache.set(key, { data: clean, expiresAt: now + CHART_TTL });
            results[key] = clean;
          }
        } catch { /* skip this ticker */ }
      })
    );
    res.json(results);
  });

  app.post("/api/prices/batch", async (req, res) => {
    const tickers: string[] = req.body?.tickers ?? [];
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: "tickers array required" });
    }
    const results: Record<string, any> = {};
    await Promise.all(
      tickers.map(async (t) => {
        const data = await getPrice(t.toUpperCase(), storage);
        if (data) results[t.toUpperCase()] = data;
      })
    );
    res.json(results);
  });

  // ── Dividends ──────────────────────────────────────────────────

  app.get("/api/dividends/:ticker", async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const data = await fetchYahooDividends(ticker);
    if (!data) return res.status(404).json({ error: "Dividend data not available" });
    res.json(data);
  });

  app.get("/api/portfolio/dividends", async (req, res) => {
    const userId = (req.user as User).id;
    const holdingsList = (await storage.getHoldings(userId)).filter(h => h.ticker !== "CASH");
    const results = await Promise.all(
      holdingsList.map(async h => {
        const div = await fetchYahooDividends(h.ticker);
        return {
          id: h.id,
          ticker: h.ticker,
          name: h.name,
          shares: h.shares,
          dividendRate: div?.dividendRate ?? 0,
          dividendYield: div?.dividendYield ?? 0,
          exDividendDate: div?.exDividendDate ?? null,
          nextPaymentDate: div?.nextPaymentDate ?? null,
          payoutFrequency: div?.payoutFrequency ?? 4,
          lastDividendValue: div?.lastDividendValue ?? 0,
          annualIncome: (div?.dividendRate ?? 0) * h.shares,
          nextPayment: (div?.nextPaymentAmount ?? div?.lastDividendValue ?? 0) * h.shares,
        };
      })
    );
    const totalAnnualIncome = results.reduce((s, r) => s + r.annualIncome, 0);
    res.json({ holdings: results, totalAnnualIncome });
  });

  app.get("/api/portfolio/dividend-growth", async (req, res) => {
    const userId = (req.user as User).id;
    const holdingsList = (await storage.getHoldings(userId)).filter(h => h.ticker !== "CASH");
    const results = await Promise.all(
      holdingsList.map(async h => {
        const [div, growth, priceData] = await Promise.all([
          fetchYahooDividends(h.ticker),
          fetchDividendHistory5yr(h.ticker),
          getPrice(h.ticker, storage),
        ]);
        if (!div || div.dividendRate === 0) return null;
        return {
          ticker: h.ticker,
          name: h.name,
          shares: h.shares,
          currentPrice: priceData?.price ?? 0,
          dividendRate: div.dividendRate,
          dividendYield: div.dividendYield,
          annualIncome: div.dividendRate * h.shares,
          cagr1yr: growth?.cagr1yr ?? null,
          cagr3yr: growth?.cagr3yr ?? null,
          cagr5yr: growth?.cagr5yr ?? null,
          streak: growth?.streak ?? 0,
          annualDps: growth?.annualDps ?? [],
        };
      })
    );
    res.json(results.filter(Boolean));
  });

  app.get("/api/portfolio/dividend-summary", async (req, res) => {
    const userId = (req.user as User).id;
    const holdingsList = (await storage.getHoldings(userId)).filter(h => h.ticker !== "CASH");
    const divData = await Promise.all(
      holdingsList.map(async h => {
        const div = await fetchYahooDividends(h.ticker);
        if (!div || div.dividendRate === 0) return null;
        return {
          annualIncome: div.dividendRate * h.shares,
          payoutFrequency: div.payoutFrequency,
          nextPaymentDate: div.nextPaymentDate,
          nextPayment: (div.nextPaymentAmount ?? div.lastDividendValue ?? 0) * h.shares,
        };
      })
    );
    const paying = divData.filter(Boolean) as NonNullable<(typeof divData)[0]>[];

    // Build 12-month distribution: 6 past months + 6 future months
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), 1);
      let amount = 0;
      for (const h of paying) {
        if (!h.nextPaymentDate) continue;
        const nextDate = new Date(h.nextPaymentDate + "T12:00:00Z");
        const interval = Math.round(12 / h.payoutFrequency);
        // How many intervals away is this month from the next payment month?
        const monthsDiff = (d.getFullYear() - nextDate.getFullYear()) * 12 + d.getMonth() - nextDate.getMonth();
        if (((monthsDiff % interval) + interval) % interval === 0) amount += h.nextPayment;
      }
      return { month: label, amount, projected: !isPast };
    });

    const totalAnnual = paying.reduce((s, h) => s + h.annualIncome, 0);
    res.json({ months, totalAnnual, avgMonthly: totalAnnual / 12 });
  });

  // ── Portfolio history ─────────────────────────────────────────

  app.get("/api/portfolio/history", async (req, res) => {
    const userId = (req.user as User).id;
    const rangeParam = (req.query.range as string) || "1y";
    const validRanges = ["3mo", "6mo", "1y", "2y", "5y"];
    const range = validRanges.includes(rangeParam) ? rangeParam : "1y";
    const mode = (req.query.mode as string) === "actual" ? "actual" : "hypothetical";

    const allHoldings = await storage.getHoldings(userId);
    const holdingsList = allHoldings.filter(h => h.ticker !== "CASH");
    if (holdingsList.length === 0) return res.json({ series: [], range, mode });

    const tickers = holdingsList.map(h => h.ticker);
    const allTickers = [...tickers, "SPY", "QQQ"];

    const priceHistories: Record<string, Array<{ date: string; close: number }>> = {};
    await Promise.all(
      allTickers.map(async t => {
        priceHistories[t] = await fetchHistoricalPrices(t, range);
      })
    );

    const spyDates = (priceHistories["SPY"] ?? []).map(d => d.date);
    if (spyDates.length === 0) return res.json({ series: [], range, mode });

    const portfolioPoints: Array<{ date: string; value: number }> = [];

    for (const date of spyDates) {
      let totalValue = 0;
      for (const h of holdingsList) {
        if (mode === "actual" && h.purchaseDate && date < h.purchaseDate) continue;
        const history = priceHistories[h.ticker] ?? [];
        const point = history.find(p => p.date === date)
          ?? history.filter(p => p.date <= date).at(-1);
        if (point) {
          totalValue += point.close * h.shares;
        } else {
          totalValue += h.avgCost * h.shares;
        }
      }
      portfolioPoints.push({ date, value: totalValue });
    }

    const firstNonZeroIdx = portfolioPoints.findIndex(p => p.value > 0);
    const normalizeIdx = firstNonZeroIdx >= 0 ? firstNonZeroIdx : 0;
    const firstPortfolio = portfolioPoints[normalizeIdx]?.value ?? 1;
    const firstSpy = priceHistories["SPY"]?.[normalizeIdx]?.close ?? priceHistories["SPY"]?.[0]?.close ?? 1;
    const firstQqq = priceHistories["QQQ"]?.[normalizeIdx]?.close ?? priceHistories["QQQ"]?.[0]?.close ?? 1;

    const series = spyDates.map((date, i) => {
      const portfolio = portfolioPoints[i]?.value ?? 0;
      const spy = priceHistories["SPY"]?.find(p => p.date === date)?.close ?? firstSpy;
      const qqq = priceHistories["QQQ"]?.find(p => p.date === date)?.close ?? firstQqq;
      const portfolioNorm = (portfolio === 0 && mode === "actual" && i < normalizeIdx)
        ? null
        : parseFloat(((portfolio / firstPortfolio) * 100).toFixed(2));
      return {
        date,
        portfolio: portfolioNorm,
        sp500: parseFloat(((spy / firstSpy) * 100).toFixed(2)),
        nasdaq: parseFloat(((qqq / firstQqq) * 100).toFixed(2)),
      };
    });

    res.json({ series, range, mode });
  });

  // ── Portfolio summary ─────────────────────────────────────────

  app.get("/api/portfolio/summary", async (req, res) => {
    const userId = (req.user as User).id;
    const [holdingsList, txList] = await Promise.all([
      storage.getHoldings(userId),
      storage.getTransactions(userId),
    ]);
    const totalRealizedPnl = txList.reduce((sum, tx) => sum + (tx.realizedPnl ?? 0), 0);
    const closedTradeCount = txList.filter(tx => (tx.type === "SELL" || tx.type === "SELL_ALL") && tx.realizedPnl != null).length;
    const tickers = Array.from(new Set(
      holdingsList.filter(h => h.ticker !== "CASH").map(h => h.ticker.toUpperCase())
    ));
    const prices: Record<string, any> = {};
    await Promise.all(
      tickers.map(async (t) => {
        const p = await getPrice(t, storage);
        if (p) prices[t] = p;
      })
    );

    let totalValue = 0;
    let totalCost = 0;
    let totalInvestedValue = 0;
    let totalInvestedCost = 0;
    const enriched = holdingsList.map(h => {
      const isCash = h.ticker === "CASH";
      const currentPrice = isCash ? 1 : (prices[h.ticker.toUpperCase()]?.price ?? 0);
      const value = isCash ? h.shares : currentPrice * h.shares;
      const cost = isCash ? h.shares : h.avgCost * h.shares;
      totalValue += value;
      totalCost += cost;
      if (!isCash) {
        totalInvestedValue += value;
        totalInvestedCost += cost;
      }
      return {
        ...h,
        currentPrice,
        value,
        cost,
        isCash,
        pnl: isCash ? 0 : value - cost,
        pnlPercent: isCash ? 0 : (cost > 0 ? ((value - cost) / cost) * 100 : 0),
        priceChange: isCash ? 0 : (prices[h.ticker.toUpperCase()]?.change ?? 0),
        priceChangePercent: isCash ? 0 : (prices[h.ticker.toUpperCase()]?.changePercent ?? 0),
      };
    });

    res.json({
      holdings: enriched,
      totalValue,
      totalCost,
      totalPnl: totalInvestedValue - totalInvestedCost,
      totalPnlPercent: totalInvestedCost > 0 ? ((totalInvestedValue - totalInvestedCost) / totalInvestedCost) * 100 : 0,
      cashValue: holdingsList.filter(h => h.ticker === "CASH").reduce((s, h) => s + h.shares, 0),
      totalRealizedPnl,
      closedTradeCount,
    });
  });

  return httpServer;
}

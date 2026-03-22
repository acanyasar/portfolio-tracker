import type { IStorage } from "./storage";
import { fetchYahooDividends } from "./dividendService";

export interface PortfolioEvent {
  date: string;          // ISO date "2026-04-02"
  ticker: string;
  companyName: string;
  type: "earnings" | "dividend" | "ex_dividend";
  detail: string;
  amount?: number;       // user's dollar payout (shares × per-share)
  epsEstimate?: number;  // consensus EPS for earnings events
}

// ── Crumb management ────────────────────────────────────────────────────────
// Only needed for the calendarEvents module (earnings + proper ex-div dates).
// If the crumb cannot be obtained, earnings events are silently skipped.
// Dividend events always work via the v8 chart API (no crumb needed).

interface CrumbState {
  crumb: string;
  cookies: string;
  fetchedAt: number;
}

let crumbState: CrumbState | null = null;
let crumbPromise: Promise<CrumbState | null> | null = null;
const CRUMB_TTL = 60 * 60 * 1000; // 1 hour

const YF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function fetchCrumb(): Promise<CrumbState | null> {
  try {
    const consentRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": YF_UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9" },
    });
    const raw = consentRes.headers.get("set-cookie") ?? "";
    const cookies = raw
      .split(",")
      .map(c => c.trim().split(";")[0])
      .filter(Boolean)
      .join("; ");

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YF_UA, "Cookie": cookies, "Accept": "*/*" },
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes("{") || crumb.length > 60 || crumb.includes("Too Many")) return null;

    return { crumb, cookies, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

async function getCrumb(): Promise<CrumbState | null> {
  if (crumbState && Date.now() - crumbState.fetchedAt < CRUMB_TTL) return crumbState;
  // Deduplicate concurrent crumb fetches (race condition guard)
  if (!crumbPromise) {
    crumbPromise = fetchCrumb().then(result => {
      crumbState = result;
      crumbPromise = null;
      return result;
    });
  }
  return crumbPromise;
}

// ── Earnings fetch via calendarEvents (needs crumb) ─────────────────────────

interface EarningsData {
  earningsDate: string;
  isRange: boolean;
  epsEstimate: number | null;
}

const earningsCache = new Map<string, { data: EarningsData | null; fetchedAt: number }>();
const earningsPending = new Map<string, Promise<EarningsData | null>>();
const EARNINGS_TTL = 24 * 60 * 60 * 1000;

async function fetchEarnings(ticker: string): Promise<EarningsData | null> {
  const cached = earningsCache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < EARNINGS_TTL) return cached.data;

  const pending = earningsPending.get(ticker);
  if (pending) return pending;

  const promise = fetchEarningsFromYahoo(ticker).then(data => {
    if (data !== undefined) earningsCache.set(ticker, { data, fetchedAt: Date.now() });
    earningsPending.delete(ticker);
    return data ?? null;
  });

  earningsPending.set(ticker, promise);
  return promise;
}

async function fetchEarningsFromYahoo(ticker: string): Promise<EarningsData | null | undefined> {
  let auth = await getCrumb();
  if (!auth) return undefined; // undefined = don't cache (crumb unavailable)

  const buildUrl = (c: string) =>
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=calendarEvents&crumb=${encodeURIComponent(c)}`;

  let res = await fetch(buildUrl(auth.crumb), {
    headers: { "User-Agent": YF_UA, "Cookie": auth.cookies, "Accept": "application/json" },
  });

  if (res.status === 401) {
    crumbState = null;
    auth = await getCrumb();
    if (!auth) return undefined;
    res = await fetch(buildUrl(auth.crumb), {
      headers: { "User-Agent": YF_UA, "Cookie": auth.cookies, "Accept": "application/json" },
    });
  }

  if (!res.ok) return undefined;

  try {
    const json = await res.json();
    const cal = json?.quoteSummary?.result?.[0]?.calendarEvents;
    const rawDates: Array<{ raw: number }> = cal?.earnings?.earningsDate ?? [];
    if (rawDates.length === 0) return null;

    return {
      earningsDate: new Date(rawDates[0].raw * 1000).toISOString().split("T")[0],
      isRange: rawDates.length > 1,
      epsEstimate: cal?.earnings?.earningsAverage?.raw ?? null,
    };
  } catch {
    return undefined;
  }
}

// ── Per-ticker event cache ────────────────────────────────────────────────────

interface CacheEntry {
  events: PortfolioEvent[];  // amounts stored as per-share
  fetchedAt: number;
}
const tickerCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function fetchEventsForTicker(
  ticker: string,
  companyName: string,
  shares: number,
  todayStr: string
): Promise<PortfolioEvent[]> {
  const cached = tickerCache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return applyShares(cached.events, shares);
  }

  // Fetch dividend info (shared cached service — no duplicate Yahoo Finance calls)
  // and earnings info (calendarEvents — needs crumb, best-effort)
  const [dividendData, earningsData] = await Promise.all([
    fetchYahooDividends(ticker),
    fetchEarnings(ticker),
  ]);

  const perShareEvents: PortfolioEvent[] = [];

  // Earnings event
  if (earningsData?.earningsDate && earningsData.earningsDate >= todayStr) {
    perShareEvents.push({
      date: earningsData.earningsDate,
      ticker,
      companyName,
      type: "earnings",
      detail: earningsData.isRange ? "Earnings (est.)" : "Earnings",
      epsEstimate: earningsData.epsEstimate ?? undefined,
    });
  }

  // Dividend payment event (per-share amount stored in cache)
  if (dividendData?.nextPaymentDate && dividendData.nextPaymentDate >= todayStr) {
    perShareEvents.push({
      date: dividendData.nextPaymentDate,
      ticker,
      companyName,
      type: "dividend",
      detail: dividendData.nextPaymentAmount > 0
        ? `$${dividendData.nextPaymentAmount.toFixed(3)}/share`
        : "Dividend",
      amount: dividendData.nextPaymentAmount > 0 ? dividendData.nextPaymentAmount : undefined,
    });
  }

  const logParts = [
    `earnings:${earningsData?.earningsDate ?? "none"}`,
    `dividend:${dividendData?.nextPaymentDate ?? "none"}`,
  ];
  console.log(`[events] ${ticker}: ${logParts.join(", ")}`);

  // Only cache if we got useful results (don't cache empty results from rate-limit failures)
  const hasMeaningfulData = dividendData !== null || earningsData !== null;
  if (hasMeaningfulData) {
    tickerCache.set(ticker, { events: perShareEvents, fetchedAt: Date.now() });
  }

  return applyShares(perShareEvents, shares);
}

function applyShares(events: PortfolioEvent[], shares: number): PortfolioEvent[] {
  return events.map(e => ({
    ...e,
    amount: e.amount != null ? e.amount * shares : undefined,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

// Process tickers in batches to avoid rate-limiting Yahoo Finance
const BATCH_SIZE = 5;

async function processBatches<T>(items: T[], fn: (item: T) => Promise<PortfolioEvent[]>): Promise<PortfolioEvent[]> {
  const results: PortfolioEvent[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults.flat());
  }
  return results;
}

export async function fetchPortfolioEvents(userId: number, storage: IStorage): Promise<PortfolioEvent[]> {
  const allHoldings = await storage.getHoldings(userId);
  const holdings = allHoldings.filter(h => h.ticker !== "CASH" && h.shares > 0);
  if (holdings.length === 0) return [];

  const todayStr = new Date().toISOString().split("T")[0];
  const in30Str = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const allEvents = await processBatches(
    holdings,
    h => fetchEventsForTicker(h.ticker, h.name, h.shares, todayStr)
  );

  return allEvents
    .filter(e => e.date >= todayStr && e.date <= in30Str)
    .sort((a, b) => a.date.localeCompare(b.date));
}

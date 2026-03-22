// Shared Yahoo Finance dividend fetcher with 24h in-memory cache.
// Imported by routes.ts (for /api/portfolio/dividends, /api/portfolio/dividend-summary, etc.)
// and eventsService.ts — a single cache prevents duplicate Yahoo Finance requests when
// multiple dashboard endpoints fire simultaneously on page load.

export interface DividendData {
  dividendRate: number;
  dividendYield: number;
  exDividendDate: string | null;
  nextPaymentDate: string | null;
  payoutFrequency: number;
  lastDividendValue: number;
  nextPaymentAmount: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
// Cache stores the resolved data (or null for non-dividend payers)
// pendingPromises prevents duplicate in-flight requests for the same ticker
const cache = new Map<string, { data: DividendData | null; fetchedAt: number }>();
const pendingPromises = new Map<string, Promise<DividendData | null>>();

export async function fetchYahooDividends(ticker: string): Promise<DividendData | null> {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  // If there's already an in-flight request for this ticker, reuse it (prevents duplicate requests
  // when multiple endpoints call this simultaneously on dashboard load)
  const pending = pendingPromises.get(ticker);
  if (pending) return pending;

  const promise = fetchFromYahoo(ticker).then(data => {
    cache.set(ticker, { data, fetchedAt: Date.now() });
    pendingPromises.delete(ticker);
    return data;
  });

  pendingPromises.set(ticker, promise);
  return promise;
}

async function fetchFromYahoo(ticker: string): Promise<DividendData | null> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const twoYearsAgo = nowSec - 2 * 365 * 24 * 60 * 60;
    const oneYearForward = nowSec + 365 * 24 * 60 * 60;
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
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
    if (!divEvents || Object.keys(divEvents).length === 0) return null;

    const allDivs = (Object.values(divEvents) as Array<{ amount: number; date: number }>)
      .sort((a, b) => a.date - b.date);

    const pastDivs   = allDivs.filter(d => d.date <= nowSec);
    const futureDivs = allDivs.filter(d => d.date > nowSec);

    const oneYearAgo = nowSec - 365 * 24 * 60 * 60;
    const lastYearDivs = pastDivs.filter(d => d.date > oneYearAgo);
    const dividendRate = lastYearDivs.reduce((s, d) => s + d.amount, 0);
    const payoutFrequency = lastYearDivs.length > 0
      ? Math.max(1, Math.min(12, lastYearDivs.length))
      : 4;

    const currentPrice = meta.regularMarketPrice ?? 1;
    const dividendYield = currentPrice > 0 ? dividendRate / currentPrice : 0;

    const positivePastDivs = pastDivs.filter(d => d.amount > 0);
    const lastDividendValue = positivePastDivs.length > 0
      ? positivePastDivs[positivePastDivs.length - 1].amount
      : 0;

    const exDividendDate = pastDivs.length > 0
      ? new Date(pastDivs[pastDivs.length - 1].date * 1000).toISOString().split("T")[0]
      : null;

    let nextPaymentDate: string | null = null;
    if (futureDivs.length > 0) {
      nextPaymentDate = new Date(futureDivs[0].date * 1000).toISOString().split("T")[0];
    } else if (pastDivs.length > 0) {
      const lastPaymentSec = pastDivs[pastDivs.length - 1].date;
      const intervalDays = Math.round(365 / payoutFrequency);
      let nextSec = lastPaymentSec + intervalDays * 24 * 60 * 60;
      while (nextSec <= nowSec) nextSec += intervalDays * 24 * 60 * 60;
      nextPaymentDate = new Date(nextSec * 1000).toISOString().split("T")[0];
    }

    const nextPaymentAmount = futureDivs.length > 0 && futureDivs[0].amount > 0
      ? futureDivs[0].amount
      : lastDividendValue;

    return { dividendRate, dividendYield, exDividendDate, nextPaymentDate, payoutFrequency, lastDividendValue, nextPaymentAmount };
  } catch {
    return null;
  }
}

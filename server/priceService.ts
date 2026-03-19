import type { IStorage } from "./storage";

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchYahooPrice(ticker: string): Promise<{
  price: number; change: number; changePercent: number;
  high52w?: number; low52w?: number; marketCap?: number; volume?: number; name?: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    return {
      price,
      change,
      changePercent,
      high52w: meta.fiftyTwoWeekHigh,
      low52w: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
      volume: meta.regularMarketVolume,
      name: meta.shortName ?? meta.longName,
    };
  } catch {
    return null;
  }
}

export async function getPrice(ticker: string, storage: IStorage) {
  const cached = await storage.getPriceCache(ticker);
  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cached;
  }
  const data = await fetchYahooPrice(ticker);
  if (!data) return cached ?? null;
  const entry = {
    ticker: ticker.toUpperCase(),
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    high52w: data.high52w ?? null,
    low52w: data.low52w ?? null,
    marketCap: data.marketCap ?? null,
    volume: data.volume ?? null,
    fetchedAt: new Date().toISOString(),
  };
  await storage.setPriceCache(entry);
  return entry;
}

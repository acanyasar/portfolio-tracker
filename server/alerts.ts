import type { IStorage } from "./storage";
import { getPrice } from "./priceService";

const ALERT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function checkAlerts(storage: IStorage) {
  // Get all users and their watchlists
  // We iterate all watchlist items across all users by fetching all users from storage
  // Since IStorage doesn't expose getAllWatchlist, we use the DB directly when available
  try {
    const { db } = await import("./db");
    const { watchlist } = await import("@shared/schema");

    const allItems = await db.select().from(watchlist);

    for (const item of allItems) {
      try {
        const priceData = await getPrice(item.ticker, storage);
        if (!priceData) continue;
        const price = priceData.price;

        // Check alert low: price has dropped to or below alertLow
        if (item.alertLow !== null && price <= item.alertLow) {
          const alreadyFired = await storage.hasUnreadNotification(item.userId, item.ticker, "ALERT_LOW");
          if (!alreadyFired) {
            await storage.createNotification(item.userId, {
              watchlistItemId: item.id,
              ticker: item.ticker,
              type: "ALERT_LOW",
              price,
              threshold: item.alertLow,
            });
          }
        }

        // Check alert high: price has risen to or above alertHigh
        if (item.alertHigh !== null && price >= item.alertHigh) {
          const alreadyFired = await storage.hasUnreadNotification(item.userId, item.ticker, "ALERT_HIGH");
          if (!alreadyFired) {
            await storage.createNotification(item.userId, {
              watchlistItemId: item.id,
              ticker: item.ticker,
              type: "ALERT_HIGH",
              price,
              threshold: item.alertHigh,
            });
          }
        }
      } catch (err) {
        console.error(`[alerts] Error checking ${item.ticker}:`, err);
      }
    }
  } catch (err) {
    console.error("[alerts] checkAlerts error:", err);
  }
}

export function startAlertJob(storage: IStorage): NodeJS.Timeout {
  // Run once immediately, then on interval
  checkAlerts(storage).catch(err => console.error("[alerts] initial check failed:", err));
  return setInterval(() => {
    checkAlerts(storage).catch(err => console.error("[alerts] interval check failed:", err));
  }, ALERT_INTERVAL_MS);
}

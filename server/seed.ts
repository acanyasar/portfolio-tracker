import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, holdings, watchlist } from "@shared/schema";

export async function seedIfEmpty() {
  // If any user exists, skip — already seeded
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("[seed] Users already present — skipping seed.");
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    throw new Error("[seed] ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env");
  }

  // Create admin user
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [adminUser] = await db.insert(users).values({ username: adminUsername, passwordHash }).returning();
  const adminId = adminUser.id;

  // Clear any leftover holdings/watchlist (from pre-auth migration)
  await db.delete(holdings);
  await db.delete(watchlist);

  // Re-insert seed holdings with userId
  await db.insert(holdings).values([
    { userId: adminId, ticker: "NVDA",  name: "NVIDIA Corporation",      shares: 120,   avgCost: 127.83, sector: "Semiconductors",     purchaseDate: "2024-01-10" },
    { userId: adminId, ticker: "AMD",   name: "Advanced Micro Devices",  shares: 85,    avgCost: 162.0,  sector: "Semiconductors",     purchaseDate: "2024-02-14" },
    { userId: adminId, ticker: "TSLA",  name: "Tesla Inc.",               shares: 40,    avgCost: 310.0,  sector: "Automotive/EV",      purchaseDate: "2024-03-05" },
    { userId: adminId, ticker: "PLTR",  name: "Palantir Technologies",   shares: 150,   avgCost: 128.84, sector: "Software/AI",        purchaseDate: "2024-04-22" },
    { userId: adminId, ticker: "APP",   name: "AppLovin Corporation",    shares: 30,    avgCost: 310.0,  sector: "Software/AI",        purchaseDate: "2024-06-18" },
    { userId: adminId, ticker: "CRDO",  name: "Credo Technology",        shares: 110,   avgCost: 55.0,   sector: "Semiconductors",     purchaseDate: "2024-07-03" },
    { userId: adminId, ticker: "IREN",  name: "IREN Limited",            shares: 180,   avgCost: 47.66,  sector: "Bitcoin Mining/AI",  purchaseDate: "2024-08-15" },
    { userId: adminId, ticker: "ALAB",  name: "Astera Labs Inc.",        shares: 20,    avgCost: 78.0,   sector: "Semiconductors",     purchaseDate: "2024-09-10" },
    { userId: adminId, ticker: "AMZN",  name: "Amazon.com Inc.",         shares: 25,    avgCost: 195.0,  sector: "Cloud/E-commerce",   purchaseDate: "2024-10-07" },
    { userId: adminId, ticker: "GOOGL", name: "Alphabet Inc.",           shares: 18,    avgCost: 170.0,  sector: "Cloud/AI",           purchaseDate: "2024-11-20" },
    { userId: adminId, ticker: "CASH",  name: "Cash & Equivalents",      shares: 15000, avgCost: 1.0,    sector: "Cash",               purchaseDate: "2025-01-01", notes: "Dry powder" },
  ]);

  await db.insert(watchlist).values([
    { userId: adminId, ticker: "CELH", name: "Celsius Holdings",  alertLow: 28.0, alertHigh: 50.0, notes: "Beverage growth play",              addedAt: new Date().toISOString() },
    { userId: adminId, ticker: "IONQ", name: "IonQ Inc.",         alertLow: 20.0, alertHigh: 45.0, notes: "Quantum computing - speculative",   addedAt: new Date().toISOString() },
    { userId: adminId, ticker: "ASTS", name: "AST SpaceMobile",   alertLow: 18.0, alertHigh: 35.0, notes: "Space broadband - wait for pull-back", addedAt: new Date().toISOString() },
  ]);

  console.log(`[seed] Created admin user '${adminUsername}' + inserted 11 holdings and 3 watchlist items`);
}

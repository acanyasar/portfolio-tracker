# Portfolio Tracker

A full-stack stock portfolio tracking application with real-time price data, dividend tracking, analytics, and watchlist management.

## Features

- **Dashboard** — Portfolio summary with total value, cost basis, P&L, cash position, and top movers. Auto-refreshes every 60 seconds.
- **Holdings** — Add, edit, and delete stock positions. Supports CSV bulk import, auto-fetches ticker names/prices/sectors, and tracks a special CASH position.
- **Watchlist** — Track stocks you don't own yet. Set price alert thresholds and monitor 52-week highs/lows.
- **Dividends** — Full dividend income tracking per holding: annual rate, yield, ex-div date, payout frequency, monthly income calendar, and 12-month projection chart.
- **Analytics** — Sector and individual holding allocation pie charts, portfolio value bar chart, and historical performance chart benchmarked against S&P 500 (SPY) and NASDAQ-100 (QQQ) with hypothetical and actual modes.

## Tech Stack

### Frontend
| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | UI library |
| Vite | 7.3.0 | Build tool & dev server |
| TypeScript | 5.6.3 | Type safety |
| TanStack Query | 5.60.5 | Server state & caching |
| Wouter | 3.3.5 | Routing |
| Tailwind CSS | 3.4.17 | Styling |
| shadcn/ui + Radix UI | — | Component library |
| Recharts | 2.15.2 | Charts & visualizations |
| Framer Motion | 11.13.1 | Animations |
| Zod | 3.24.2 | Schema validation |

### Backend
| Tool | Version | Purpose |
|------|---------|---------|
| Express | 5.0.1 | Web server |
| Drizzle ORM | 0.39.3 | Type-safe SQL ORM |
| PostgreSQL (pg) | 8.16.3 | Database |
| esbuild | 0.25.0 | Server bundler |
| tsx | 4.20.5 | TypeScript execution |

## Project Structure

```
portfolio-tracker/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/           # Dashboard, Holdings, Analytics, Dividends, Watchlist
│       ├── components/
│       │   ├── ui/          # shadcn/ui component library
│       │   └── Sidebar.tsx
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Utilities (queryClient, utils)
├── server/                  # Express backend
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # In-memory storage implementation
│   └── vite.ts              # Vite middleware for dev
├── shared/
│   └── schema.ts            # Drizzle ORM schema (shared between client & server)
├── migrations/              # Drizzle-generated DB migrations
├── script/
│   └── build.ts             # esbuild + Vite build script
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (for production)

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/portfolio_tracker
PORT=5000
```

> **Note:** The app currently uses in-memory storage with seed data by default. A `DATABASE_URL` is required only when pushing schema changes via Drizzle.

### Development
```bash
npm run dev
```
Starts the Express server with Vite HMR at `http://localhost:5000`.

### Production
```bash
npm run build   # Builds client (Vite) and server (esbuild) to dist/
npm start       # Runs the production server
```

### Database
```bash
npm run db:push  # Apply schema changes to your PostgreSQL database
```

### Type Check
```bash
npm run check
```

## API Endpoints

### Holdings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holdings` | Get all holdings |
| POST | `/api/holdings` | Create a holding |
| PUT | `/api/holdings/:id` | Update a holding |
| DELETE | `/api/holdings/:id` | Delete a holding |
| POST | `/api/holdings/import` | Bulk import from CSV |

### Watchlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/watchlist` | Get all watchlist items |
| POST | `/api/watchlist` | Add watchlist item |
| PUT | `/api/watchlist/:id` | Update watchlist item |
| DELETE | `/api/watchlist/:id` | Delete watchlist item |

### Prices (Yahoo Finance, cached 5 min)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lookup/:ticker` | Ticker validation & company info |
| GET | `/api/prices/:ticker` | Current price data |
| POST | `/api/prices/batch` | Batch fetch prices |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolio/summary` | Total value, P&L, enriched holdings |
| GET | `/api/portfolio/history` | Historical prices (params: `range`, `mode`) |
| GET | `/api/portfolio/dividends` | Portfolio-wide dividend summary |
| GET | `/api/dividends/:ticker` | Dividend data for a single ticker |

## Database Schema

### `holdings`
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| ticker | text | Stock ticker symbol |
| name | text | Company name |
| shares | real | Number of shares |
| avgCost | real | Average cost per share |
| sector | text | Sector classification |
| notes | text | Optional notes |
| purchaseDate | text | ISO date string |

### `watchlist`
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| ticker | text | Stock ticker |
| name | text | Company name |
| alertLow | real | Low price alert threshold |
| alertHigh | real | High price alert threshold |
| notes | text | Optional notes |
| addedAt | text | ISO timestamp |

### `priceCache`
| Column | Type | Description |
|--------|------|-------------|
| ticker | text PK | Stock ticker |
| price | real | Current price |
| change | real | Price change ($) |
| changePercent | real | Price change (%) |
| high52w | real | 52-week high |
| low52w | real | 52-week low |
| marketCap | real | Market capitalization |
| volume | integer | Trading volume |
| fetchedAt | text | ISO timestamp |

## Supported Sectors

`Semiconductors` · `Software/AI` · `Cloud/AI` · `Cloud/E-commerce` · `Automotive/EV` · `Bitcoin Mining/AI` · `Biotech` · `Energy` · `Finance` · `Consumer` · `Healthcare` · `Industrial` · `Real Estate` · `Cash` · `Other`

## Data Source

Real-time and historical price data is fetched from **Yahoo Finance** (no API key required). All price data is cached with a 5-minute TTL.

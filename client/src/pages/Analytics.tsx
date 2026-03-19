import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EnrichedHolding {
  id: number;
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  sector: string;
  notes: string;
  purchaseDate?: string | null;
  isCash?: boolean;
  currentPrice: number;
  value: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  priceChange: number;
  priceChangePercent: number;
}

interface PortfolioSummary {
  holdings: EnrichedHolding[];
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashValue?: number;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const COLORS = [
  "hsl(210 100% 56%)",
  "hsl(145 63% 42%)",
  "hsl(35 95% 58%)",
  "hsl(260 70% 60%)",
  "hsl(185 70% 50%)",
  "hsl(15 85% 60%)",
  "hsl(330 70% 60%)",
  "hsl(75 60% 50%)",
  "hsl(200 70% 60%)",
  "hsl(50 90% 60%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-lg">
      {label && <div className="font-semibold text-foreground mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || p.fill }} className="flex items-center gap-1.5">
          <span>{p.name}:</span>
          <span className="font-mono-nums font-semibold">{p.value?.toLocaleString?.() ?? p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-lg">
      <div className="font-semibold" style={{ color: d.payload.fill }}>{d.name}</div>
      <div className="text-muted-foreground">${fmt(d.value)} · {fmt(d.payload.pct)}%</div>
    </div>
  );
};

interface HistoryPoint {
  date: string;
  portfolio: number;
  sp500: number;
  nasdaq: number;
}

interface HistoryData {
  series: HistoryPoint[];
  range: string;
}

const RANGE_OPTIONS = [
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
];

export default function Analytics() {
  const [benchmarkRange, setBenchmarkRange] = useState("1y");
  const [benchmarkMode, setBenchmarkMode] = useState<"hypothetical" | "actual">("hypothetical");
  const { data, isLoading } = useQuery<PortfolioSummary>({ queryKey: ["/api/portfolio/summary"] });
  const { data: histData, isLoading: histLoading } = useQuery<HistoryData>({
    queryKey: ["/api/portfolio/history", benchmarkRange, benchmarkMode],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/history?range=${benchmarkRange}&mode=${benchmarkMode}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const priced = data.holdings.filter(h => h.currentPrice > 0 && !h.isCash);
  const totalValue = priced.reduce((s, h) => s + h.value, 0);
  const cashValue = data.cashValue ?? 0;

  const allocationData = [
    ...priced.map(h => ({ name: h.ticker, value: h.value, pct: (totalValue + cashValue) > 0 ? (h.value / (totalValue + cashValue)) * 100 : 0 })),
    ...(cashValue > 0 ? [{ name: "CASH", value: cashValue, pct: (totalValue + cashValue) > 0 ? (cashValue / (totalValue + cashValue)) * 100 : 0 }] : []),
  ].sort((a, b) => b.value - a.value);

  const sectorMap: Record<string, number> = {};
  for (const h of priced) {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.value;
  }
  if (cashValue > 0) sectorMap["Cash"] = (sectorMap["Cash"] ?? 0) + cashValue;
  const totalWithCash = totalValue + cashValue;
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: totalWithCash > 0 ? (value / totalWithCash) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const pnlData = priced
    .map(h => ({ ticker: h.ticker, pnl: h.pnl, pnlPct: h.pnlPercent }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  const cvData = data.holdings
    .filter(h => !h.isCash)
    .sort((a, b) => b.avgCost * b.shares - a.avgCost * a.shares)
    .slice(0, 10)
    .map(h => ({
      ticker: h.ticker,
      Cost: Math.round(h.avgCost * h.shares),
      Value: h.currentPrice > 0 ? Math.round(h.value) : 0,
    }));

  const sortedPriced = [...priced].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-base font-semibold text-foreground">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Portfolio breakdown · {priced.length} priced positions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Allocation Pie */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Allocation by Position</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <ResponsiveContainer width="100%" height={200} className="sm:w-1/2 sm:flex-none" style={{ width: undefined }}>
                <PieChart>
                  <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px] scrollbar-thin">
                {allocationData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="font-semibold text-foreground">{d.name}</span>
                    </div>
                    <span className="font-mono-nums text-muted-foreground">{fmt(d.pct, 1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sector Pie */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Sector Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <ResponsiveContainer width="100%" height={200} className="sm:w-1/2 sm:flex-none" style={{ width: undefined }}>
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px] scrollbar-thin">
                {sectorData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-foreground truncate">{d.name}</span>
                    </div>
                    <span className="font-mono-nums text-muted-foreground shrink-0">{fmt(d.pct, 1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* P&L Bar Chart */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Unrealized P&L by Position ($)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pnlData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="ticker" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
                <Tooltip content={<CustomTooltip />} formatter={(v: number) => [`$${fmt(v)}`, "P&L"]} />
                <Bar dataKey="pnl" name="P&L" radius={[3, 3, 0, 0]}>
                  {pnlData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "hsl(145 63% 42%)" : "hsl(0 72% 51%)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost vs Value */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Cost Basis vs Current Value</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cvData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="ticker" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip content={<CustomTooltip />} formatter={(v: number) => [`$${fmt(v, 0)}`, ""]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Cost" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} opacity={0.7} />
                <Bar dataKey="Value" fill="hsl(210 100% 56%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Benchmark Comparison Chart */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Portfolio vs Benchmarks</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Indexed to 100 at start of period · weekly data</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 bg-accent rounded-md p-0.5">
                {(["hypothetical", "actual"] as const).map(m => (
                  <button
                    key={m}
                    data-testid={`btn-mode-${m}`}
                    onClick={() => setBenchmarkMode(m)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                      benchmarkMode === m
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "hypothetical" ? "All-in" : "Actual"}
                  </button>
                ))}
              </div>
              {/* Range buttons */}
              <div className="flex items-center gap-1">
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    data-testid={`btn-range-${opt.value}`}
                    onClick={() => setBenchmarkRange(opt.value)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      benchmarkRange === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {histLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !histData?.series?.length ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              Loading chart data…
            </div>
          ) : (() => {
            const last = histData.series[histData.series.length - 1];
            const portReturn = last ? (last.portfolio - 100).toFixed(1) : "0.0";
            const spReturn = last ? (last.sp500 - 100).toFixed(1) : "0.0";
            const nqReturn = last ? (last.nasdaq - 100).toFixed(1) : "0.0";
            const portPos = last ? last.portfolio >= 100 : true;
            const ChartTooltip = ({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-lg min-w-[160px]">
                  <div className="font-semibold text-muted-foreground mb-1.5">{label}</div>
                  {payload.map((p: any) => (
                    <div key={p.dataKey} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </div>
                      <span className="font-mono font-semibold" style={{ color: p.color }}>
                        {p.value > 100 ? "+" : ""}{(p.value - 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            };
            return (
              <>
                <div className="flex items-center gap-3 px-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs font-semibold">My Portfolio</span>
                    <span className={cn("text-xs font-mono font-bold ml-0.5", portPos ? "text-up" : "text-down")}>
                      {portPos ? "+" : ""}{portReturn}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: "hsl(35 95% 58%)" }} />
                    <span className="text-xs text-muted-foreground">S&P 500</span>
                    <span className={cn("text-xs font-mono font-bold ml-0.5", parseFloat(spReturn) >= 0 ? "text-up" : "text-down")}>
                      {parseFloat(spReturn) >= 0 ? "+" : ""}{spReturn}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: "hsl(260 70% 60%)" }} />
                    <span className="text-xs text-muted-foreground">NASDAQ</span>
                    <span className={cn("text-xs font-mono font-bold ml-0.5", parseFloat(nqReturn) >= 0 ? "text-up" : "text-down")}>
                      {parseFloat(nqReturn) >= 0 ? "+" : ""}{nqReturn}%
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={histData.series} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={d => {
                        const dt = new Date(d + "T12:00:00Z");
                        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                      interval={Math.floor(histData.series.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={v => `${(v - 100).toFixed(0)}%`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="portfolio" name="My Portfolio" stroke="hsl(210 100% 56%)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="sp500" name="S&P 500" stroke="hsl(35 95% 58%)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" activeDot={{ r: 3 }} />
                    <Line type="monotone" dataKey="nasdaq" name="NASDAQ" stroke="hsl(260 70% 60%)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Detailed P&L Table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Position Performance Detail</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border/50">
            {sortedPriced.map(h => (
              <div key={h.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground text-sm">{h.ticker}</span>
                    <span className="text-xs text-muted-foreground ml-2">{h.sector}</span>
                  </div>
                  <div className={cn("text-sm font-bold font-mono-nums", h.pnl >= 0 ? "text-up" : "text-down")}>
                    {h.pnl >= 0 ? "+" : ""}${fmt(Math.abs(h.pnl))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cost <span className="font-mono-nums text-foreground">${fmt(h.cost)}</span></span>
                  <span>Value <span className="font-mono-nums text-foreground">${fmt(h.value)}</span></span>
                  <span className={cn("font-semibold font-mono-nums", h.pnlPercent >= 0 ? "text-up" : "text-down")}>
                    {h.pnlPercent >= 0 ? "+" : ""}{fmt(h.pnlPercent)}%
                  </span>
                  <span className="text-muted-foreground font-mono-nums">
                    {totalWithCash > 0 ? fmt((h.value / totalWithCash) * 100, 1) : "0.0"}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-muted-foreground font-medium">Ticker</th>
                  <th className="px-4 py-2 text-left text-muted-foreground font-medium">Sector</th>
                  <th className="px-4 py-2 text-right text-muted-foreground font-medium">Cost Basis</th>
                  <th className="px-4 py-2 text-right text-muted-foreground font-medium">Current Value</th>
                  <th className="px-4 py-2 text-right text-muted-foreground font-medium">P&L ($)</th>
                  <th className="px-4 py-2 text-right text-muted-foreground font-medium">P&L (%)</th>
                  <th className="px-4 py-2 text-right text-muted-foreground font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {sortedPriced.map(h => (
                  <tr key={h.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{h.ticker}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{h.sector}</td>
                    <td className="px-4 py-2.5 text-right font-mono-nums">${fmt(h.cost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-nums">${fmt(h.value)}</td>
                    <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", h.pnl >= 0 ? "text-up" : "text-down")}>
                      {h.pnl >= 0 ? "+" : ""}${fmt(h.pnl)}
                    </td>
                    <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", h.pnlPercent >= 0 ? "text-up" : "text-down")}>
                      {h.pnlPercent >= 0 ? "+" : ""}{fmt(h.pnlPercent)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                      {totalWithCash > 0 ? fmt((h.value / totalWithCash) * 100, 1) : "0.0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

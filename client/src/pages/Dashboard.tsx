import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw, AlertCircle, Banknote, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, fmt } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

function fmtCurrency(n: number) {
  return "$" + fmt(n);
}

function PnlBadge({ value, percent }: { value: number; percent: number }) {
  const up = value >= 0;
  return (
    <span className={cn("font-mono-nums text-xs font-medium", up ? "text-up" : "text-down")}>
      {up ? "+" : ""}{fmtCurrency(value)} ({up ? "+" : ""}{fmt(percent)}%)
    </span>
  );
}

function KpiCard({ title, value, sub, icon: Icon, colorClass }: {
  title: string; value: string; sub?: React.ReactNode; icon: any; colorClass?: string;
}) {
  return (
    <Card data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className={cn("text-xl font-semibold font-mono-nums leading-tight", colorClass)}>{value}</p>
            {sub && <div className="mt-1">{sub}</div>}
          </div>
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-3", colorClass ? "bg-current/10" : "bg-muted")}>
            <Icon className={cn("w-4 h-4", colorClass || "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SortField = "ticker" | "shares" | "avgCost" | "currentPrice" | "value" | "pnl" | "priceChangePercent" | "weight";

export default function Dashboard() {
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const { data, isLoading, error, dataUpdatedAt } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"],
    refetchInterval: 60_000,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await apiRequest("POST", "/api/prices/invalidate");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setIsRefreshing(false);
    }
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Today's total PP&L -L - exclude CASH (no price movement)
  const todayPnl = data?.holdings.filter(h => !h.isCash).reduce((sum, h) => sum + h.priceChange * h.shares, 0) ?? 0;

  // Top movers - exclude CASH
  const sorted = data ? [...data.holdings].filter(h => !h.isCash).sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent)) : [];
  const topMovers = sorted.slice(0, 5);

  // Stats
  const investedHoldings = data?.holdings.filter(h => !h.isCash) ?? [];
  const cashValue = data?.cashValue ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Portfolio Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">Updated {lastUpdated}</p>
          )}
        </div>
        <Button
          data-testid="btn-refresh"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="text-xs h-7 px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load portfolio data. Check your connection.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))
        ) : data ? (
          <>
            <KpiCard
              title="Total Value"
              value={fmtCurrency(data.totalValue)}
              icon={DollarSign}
              sub={
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Invested: {fmtCurrency(data.totalCost)}</span>
                  {cashValue > 0 && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                      <Banknote className="w-3 h-3" /> Cash: {fmtCurrency(cashValue)}
                    </span>
                  )}
                </div>
              }
            />
            <KpiCard
              title="Total P&L"
              value={(data.totalPnl >= 0 ? "+" : "") + fmtCurrency(data.totalPnl)}
              icon={data.totalPnl >= 0 ? TrendingUp : TrendingDown}
              colorClass={data.totalPnl >= 0 ? "text-up" : "text-down"}
              sub={
                <span className={cn("text-xs font-mono-nums", data.totalPnl >= 0 ? "text-up" : "text-down")}>
                  {data.totalPnl >= 0 ? "+" : ""}{fmt(data.totalPnlPercent)}%
                </span>
              }
            />
            <KpiCard
              title="Today's P&L"
              value={(todayPnl >= 0 ? "+" : "") + fmtCurrency(todayPnl)}
              icon={todayPnl >= 0 ? TrendingUp : TrendingDown}
              colorClass={todayPnl >= 0 ? "text-up" : "text-down"}
            />
            <KpiCard
              title="Positions"
              value={String(investedHoldings.length)}
              icon={BarChart3}
              sub={
                <span className="text-xs text-muted-foreground">
                  {new Set(investedHoldings.map(h => h.sector)).size} sectors
                  {cashValue > 0 && <span className="ml-1 text-green-600 dark:text-green-400">+ cash</span>}
                </span>
              }
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Holdings Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Positions</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {([
                      { field: "ticker" as SortField, label: "Ticker", align: "left" },
                      { field: "shares" as SortField, label: "Shares", align: "right" },
                      { field: "avgCost" as SortField, label: "Avg Cost", align: "right" },
                      { field: "currentPrice" as SortField, label: "Price", align: "right" },
                      { field: "value" as SortField, label: "Value", align: "right" },
                      { field: "pnl" as SortField, label: "P&L", align: "right" },
                      { field: "priceChangePercent" as SortField, label: "Day", align: "right" },
                      { field: "weight" as SortField, label: "Weight", align: "right" },
                    ] as const).map(({ field, label, align }) => (
                      <th
                        key={field}
                        onClick={() => handleSort(field)}
                        className={cn(
                          "px-4 py-2 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors",
                          align === "right" ? "text-right" : "text-left"
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {align === "right" && sortField === field && (
                            sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                          {label}
                          {align === "left" && sortField === field && (
                            sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-2.5">
                              <Skeleton className="h-3 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : data?.holdings
                        .slice()
                        .sort((a, b) => {
                          if (a.isCash && !b.isCash) return 1;
                          if (b.isCash && !a.isCash) return -1;
                          const totalValue = data?.totalValue ?? 1;
                          const av = sortField === "weight" ? a.value / totalValue : (a[sortField as keyof EnrichedHolding] as number) ?? 0;
                          const bv = sortField === "weight" ? b.value / totalValue : (b[sortField as keyof EnrichedHolding] as number) ?? 0;
                          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                          return sortDir === "asc" ? cmp : -cmp;
                        })
                        .map((h) => (
                          <tr
                            key={h.id}
                            data-testid={`row-holding-${h.id}`}
                            className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              {h.isCash ? (
                                <div className="flex items-center gap-1.5">
                                  <Banknote className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  <div>
                                    <span className="font-semibold text-green-600 dark:text-green-400">CASH</span>
                                    <div className="text-muted-foreground text-xs truncate max-w-[100px]">{h.name}</div>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-foreground">{h.ticker}</span>
                                  <div className="text-muted-foreground text-xs truncate max-w-[120px]">{h.name}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                              {h.isCash ? "" : fmt(h.shares, 0)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                              {h.isCash ? "" : `$${fmt(h.avgCost)}`}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums font-medium">
                              {h.isCash ? "" : (h.currentPrice > 0 ? `$${fmt(h.currentPrice)}` : "")}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums">
                              {fmtCurrency(h.value)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums">
                              {h.isCash ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Cash</span>
                              ) : h.currentPrice > 0 ? (
                                <PnlBadge value={h.pnl} percent={h.pnlPercent} />
                              ) : ""}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums">
                              {(!h.isCash && h.currentPrice > 0) && (
                                <span className={h.priceChangePercent >= 0 ? "text-up" : "text-down"}>
                                  {h.priceChangePercent >= 0 ? "+" : ""}{fmt(h.priceChangePercent)}%
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                              {data?.totalValue ? fmt((h.value / data.totalValue) * 100, 1) + "%" : ""}
                            </td>
                          </tr>
                        ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Movers */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Top Movers Today</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              : topMovers.map((h) => (
                  <div
                    key={h.id}
                    data-testid={`mover-${h.ticker}`}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      h.priceChangePercent >= 0 ? "bg-up-subtle" : "bg-down-subtle"
                    )}
                  >
                    <div>
                      <span className="font-semibold text-sm text-foreground">{h.ticker}</span>
                      <div className="text-xs text-muted-foreground">{fmtCurrency(h.currentPrice)}</div>
                    </div>
                    <div className="text-right">
                      <span className={cn("font-mono-nums text-sm font-semibold", h.priceChangePercent >= 0 ? "text-up" : "text-down")}>
                        {h.priceChangePercent >= 0 ? "+" : ""}{fmt(h.priceChangePercent)}%
                      </span>
                      <div className={cn("text-xs font-mono-nums", h.priceChangePercent >= 0 ? "text-up" : "text-down")}>
                        {h.priceChange >= 0 ? "+" : ""}{fmtCurrency(h.priceChange)}
                      </div>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

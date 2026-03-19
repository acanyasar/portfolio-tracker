import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarDays, TrendingUp, DollarSign, Clock } from "lucide-react";

interface DividendHolding {
  id: number;
  ticker: string;
  name: string;
  shares: number;
  dividendRate: number;
  dividendYield: number;
  exDividendDate: string | null;
  nextPaymentDate: string | null;
  payoutFrequency: number;
  lastDividendValue: number;
  annualIncome: number;
  nextPayment: number;
}

interface DividendSummary {
  holdings: DividendHolding[];
  totalAnnualIncome: number;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function freqLabel(freq: number) {
  if (freq === 1) return "Annual";
  if (freq === 2) return "Semi-annual";
  if (freq === 4) return "Quarterly";
  if (freq === 12) return "Monthly";
  return "Quarterly";
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  const target = new Date(iso + "T12:00:00Z");
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// Build a 12-month calendar of expected income events
function buildCalendar(holdings: DividendHolding[]) {
  const months: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 12; i++) months[monthNames[i]] = 0;

  for (const h of holdings) {
    if (h.annualIncome <= 0) continue;
    const perPayment = h.nextPayment > 0 ? h.nextPayment : h.annualIncome / h.payoutFrequency;
    // Distribute payments evenly across months based on frequency
    const interval = Math.round(12 / h.payoutFrequency);
    // Try to anchor to the next payment month if available
    let startMonth = 0;
    if (h.nextPaymentDate) {
      startMonth = new Date(h.nextPaymentDate + "T12:00:00Z").getMonth();
    }
    for (let p = 0; p < h.payoutFrequency; p++) {
      const monthIdx = (startMonth + p * interval) % 12;
      months[monthNames[monthIdx]] += perPayment;
    }
  }
  return Object.entries(months).map(([month, income]) => ({ month, income }));
}

const FREQ_COLORS: Record<number, string> = {
  1: "hsl(260 70% 60%)",
  2: "hsl(185 70% 50%)",
  4: "hsl(210 100% 56%)",
  12: "hsl(145 63% 42%)",
};

export default function Dividends() {
  const { data, isLoading } = useQuery<DividendSummary>({
    queryKey: ["/api/portfolio/dividends"],
  });

  const [sortBy, setSortBy] = useState<"income" | "yield" | "date">("income");

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!data) return null;

  const payingHoldings = data.holdings.filter(h => h.annualIncome > 0);
  const nonPaying = data.holdings.filter(h => h.annualIncome === 0);

  // Next upcoming dividend across all holdings
  const upcoming = payingHoldings
    .filter(h => h.nextPaymentDate)
    .sort((a, b) => (a.nextPaymentDate ?? "").localeCompare(b.nextPaymentDate ?? ""));
  const nextUp = upcoming[0];
  const nextUpDays = nextUp ? daysUntil(nextUp.nextPaymentDate) : null;

  // Monthly income (next 12m)
  const monthlyTotal = data.totalAnnualIncome / 12;

  // Sorted holdings
  const sorted = [...payingHoldings].sort((a, b) => {
    if (sortBy === "income") return b.annualIncome - a.annualIncome;
    if (sortBy === "yield") return b.dividendYield - a.dividendYield;
    return (a.nextPaymentDate ?? "9999").localeCompare(b.nextPaymentDate ?? "9999");
  });

  const calendarData = buildCalendar(payingHoldings);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-lg">
        <div className="font-semibold text-foreground mb-1">{label}</div>
        <div className="text-primary font-mono font-semibold">${fmt(payload[0].value)}</div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-foreground">Dividend Income</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {payingHoldings.length} dividend-paying positions · {nonPaying.length} non-paying
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Annual Income</p>
                <p className="text-xl font-bold font-mono-nums text-foreground mt-1">
                  ${fmt(data.totalAnnualIncome)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">${fmt(monthlyTotal)}/mo avg</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg Portfolio Yield</p>
                <p className="text-xl font-bold font-mono-nums text-foreground mt-1">
                  {payingHoldings.length > 0
                    ? fmt(payingHoldings.reduce((s, h) => s + h.dividendYield, 0) / payingHoldings.length * 100, 2)
                    : "0.00"}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{payingHoldings.length} positions paying</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next Payment</p>
                {nextUp ? (
                  <>
                    <p className="text-xl font-bold font-mono-nums text-foreground mt-1">
                      {nextUp.ticker}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(nextUp.nextPaymentDate)}
                      {nextUpDays !== null && nextUpDays >= 0 && (
                        <span className="ml-1 text-primary font-semibold">in {nextUpDays}d</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">No upcoming</p>
                )}
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Calendar */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">12-Month Income Calendar</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Projected dividend income by month based on current holdings</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calendarData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" name="Income" radius={[3, 3, 0, 0]}>
                {calendarData.map((d, i) => {
                  const now = new Date();
                  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                  const isCurrentMonth = months[now.getMonth()] === d.month;
                  return (
                    <Cell
                      key={i}
                      fill={isCurrentMonth ? "hsl(145 63% 42%)" : "hsl(210 100% 56%)"}
                      opacity={d.income > 0 ? 1 : 0.25}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Holdings Table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Dividend Holdings</CardTitle>
            <div className="flex items-center gap-1">
              {(["income", "yield", "date"] as const).map(s => (
                <button
                  key={s}
                  data-testid={`btn-sort-${s}`}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    sortBy === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {s === "income" ? "By Income" : s === "yield" ? "By Yield" : "By Date"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Ticker</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Shares</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Annual Rate</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Yield</th>
                <th className="px-4 py-2 text-center text-muted-foreground font-medium">Frequency</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Next Payment</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Next Amount</th>
                <th className="px-4 py-2 text-right text-muted-foreground font-medium">Annual Income</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const days = daysUntil(h.nextPaymentDate);
                return (
                  <tr key={h.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-foreground">{h.ticker}</div>
                      <div className="text-muted-foreground text-[10px] truncate max-w-[120px]">{h.name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                      {h.shares.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums">
                      ${fmt(h.dividendRate, 3)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-up font-semibold">
                      {fmt(h.dividendYield * 100, 2)}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5"
                        style={{ color: FREQ_COLORS[h.payoutFrequency] }}
                      >
                        {freqLabel(h.payoutFrequency)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">
                      <div>{fmtDate(h.nextPaymentDate)}</div>
                      {days !== null && days >= 0 && days <= 60 && (
                        <div className="text-[10px] text-primary font-semibold">in {days}d</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-foreground">
                      {h.nextPayment > 0 ? `$${fmt(h.nextPayment)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-up">
                      {h.annualIncome > 0 ? `$${fmt(h.annualIncome)}` : "—"}
                    </td>
                  </tr>
                );
              })}
              {nonPaying.length > 0 && (
                <>
                  <tr className="border-b border-border/30">
                    <td colSpan={8} className="px-4 py-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wide bg-accent/30">
                      Non-dividend paying
                    </td>
                  </tr>
                  {nonPaying.map(h => (
                    <tr key={h.id} className="border-b border-border/30 opacity-50">
                      <td className="px-4 py-2 font-semibold text-foreground">{h.ticker}</td>
                      <td className="px-4 py-2 text-right font-mono-nums text-muted-foreground">{h.shares}</td>
                      <td colSpan={6} className="px-4 py-2 text-muted-foreground text-center">No dividend</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            {/* Total row */}
            {payingHoldings.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-accent/30">
                  <td className="px-4 py-2.5 font-semibold text-foreground" colSpan={7}>Total Annual Income</td>
                  <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-up text-sm">
                    ${fmt(data.totalAnnualIncome)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

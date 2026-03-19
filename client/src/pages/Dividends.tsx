import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, fmt } from "@/lib/utils";
import { CalendarDays, TrendingUp, DollarSign, Clock, Target, Repeat2, TrendingDown, Minus } from "lucide-react";

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

interface GrowthHolding {
  ticker: string;
  name: string;
  shares: number;
  currentPrice: number;
  dividendRate: number;
  dividendYield: number;
  annualIncome: number;
  cagr1yr: number | null;
  cagr3yr: number | null;
  cagr5yr: number | null;
  streak: number;
  annualDps: Array<{ year: number; dps: number }>;
}

interface ProjectionPoint {
  year: number;
  income: number;
  cumulative: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function freqLabel(freq: number) {
  if (freq === 1) return "Annual";
  if (freq === 2) return "Semi-ann";
  if (freq === 4) return "Quarterly";
  if (freq === 12) return "Monthly";
  return "Quarterly";
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  const target = new Date(iso + "T12:00:00Z");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function buildCalendar(holdings: DividendHolding[]) {
  const months: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 12; i++) months[monthNames[i]] = 0;
  for (const h of holdings) {
    if (h.annualIncome <= 0) continue;
    const perPayment = h.nextPayment > 0 ? h.nextPayment : h.annualIncome / h.payoutFrequency;
    const interval = Math.round(12 / h.payoutFrequency);
    let startMonth = 0;
    if (h.nextPaymentDate) startMonth = new Date(h.nextPaymentDate + "T12:00:00Z").getMonth();
    for (let p = 0; p < h.payoutFrequency; p++) {
      const monthIdx = (startMonth + p * interval) % 12;
      months[monthNames[monthIdx]] += perPayment;
    }
  }
  return Object.entries(months).map(([month, income]) => ({ month, income }));
}

function computeProjections(
  holdings: GrowthHolding[],
  horizon: number,
  drip: boolean,
  monthlyContrib: number,
  globalOverridePercent: number | null
): ProjectionPoint[] {
  if (holdings.length === 0) return [];

  const states = holdings.map(h => ({
    shares: h.shares,
    baseDps: h.dividendRate,
    currentPrice: h.currentPrice > 0 ? h.currentPrice : 50,
    cagr: Math.max(-0.99, globalOverridePercent !== null
      ? globalOverridePercent / 100
      : (h.cagr3yr ?? h.cagr1yr ?? 0.03)),
  }));

  const results: ProjectionPoint[] = [];
  let cumulative = 0;

  for (let y = 1; y <= horizon; y++) {
    const incomes = states.map(s => s.shares * s.baseDps * Math.pow(1 + s.cagr, y));
    const yearIncome = incomes.reduce((a, b) => a + b, 0);
    cumulative += yearIncome;
    results.push({ year: y, income: yearIncome, cumulative });

    // Reinvest dividends via DRIP (for next year).
    // Use price appreciated at the same rate as the dividend to avoid overstating
    // share accumulation — dividend growers' prices typically track dividend growth.
    if (drip) {
      states.forEach((s, i) => {
        const appreciatedPrice = s.currentPrice * Math.pow(1 + Math.max(0, s.cagr), y);
        s.shares += incomes[i] / appreciatedPrice;
      });
    }

    // Buy more shares with monthly contribution (proportional to portfolio weight)
    if (monthlyContrib > 0) {
      const totalVal = states.reduce((s, h) => s + h.shares * h.currentPrice, 0);
      states.forEach(s => {
        const weight = totalVal > 0 ? (s.shares * s.currentPrice) / totalVal : 1 / states.length;
        s.shares += (monthlyContrib * 12 * weight) / s.currentPrice;
      });
    }
  }

  return results;
}

function growthSignal(cagr: number | null): { label: string; color: string; icon: React.ReactNode } {
  if (cagr === null) return { label: "No data", color: "text-muted-foreground", icon: <Minus className="w-3 h-3" /> };
  if (cagr > 0.01) return { label: "Growing", color: "text-up", icon: <TrendingUp className="w-3 h-3" /> };
  if (cagr < -0.01) return { label: "Cutting", color: "text-down", icon: <TrendingDown className="w-3 h-3" /> };
  return { label: "Flat", color: "text-amber-500", icon: <Minus className="w-3 h-3" /> };
}

function cagrLabel(v: number | null) {
  if (v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${fmt(v * 100, 1)}%`;
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
  const { data: growthData, isLoading: growthLoading } = useQuery<GrowthHolding[]>({
    queryKey: ["/api/portfolio/dividend-growth"],
  });

  const [sortBy, setSortBy] = useState<"income" | "yield" | "date">("income");

  // Calculator state
  const [horizon, setHorizon] = useState(10);
  const [drip, setDrip] = useState(false);
  const [monthlyContrib, setMonthlyContrib] = useState("");
  const [growthOverride, setGrowthOverride] = useState("");
  const [goalIncome, setGoalIncome] = useState("");

  const projections = useMemo(() => {
    if (!growthData || growthData.length === 0) return [];
    const override = growthOverride !== "" ? parseFloat(growthOverride) : null;
    return computeProjections(
      growthData,
      horizon,
      drip,
      parseFloat(monthlyContrib) || 0,
      isNaN(override as any) ? null : override
    );
  }, [growthData, horizon, drip, monthlyContrib, growthOverride]);

  const projNoDrip = useMemo(() => {
    if (!growthData || growthData.length === 0) return [];
    const override = growthOverride !== "" ? parseFloat(growthOverride) : null;
    return computeProjections(growthData, horizon, false, 0, isNaN(override as any) ? null : override);
  }, [growthData, horizon, growthOverride]);

  const chartData = useMemo(() => projections.map((p, i) => ({
    year: `Yr ${p.year}`,
    withSettings: Math.round(p.income),
    baseline: Math.round(projNoDrip[i]?.income ?? p.income),
  })), [projections, projNoDrip]);

  const goalMonthly = parseFloat(goalIncome) || 0;
  const currentMonthly = data ? data.totalAnnualIncome / 12 : 0;
  const goalProgress = goalMonthly > 0 ? Math.min(100, (currentMonthly / goalMonthly) * 100) : 0;
  const goalYear = goalMonthly > 0
    ? projections.find(p => p.income / 12 >= goalMonthly)?.year ?? null
    : null;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
  const upcoming = payingHoldings
    .filter(h => h.nextPaymentDate)
    .sort((a, b) => (a.nextPaymentDate ?? "").localeCompare(b.nextPaymentDate ?? ""));
  const nextUp = upcoming[0];
  const nextUpDays = nextUp ? daysUntil(nextUp.nextPaymentDate) : null;
  const monthlyTotal = data.totalAnnualIncome / 12;
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
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }} className="font-mono font-semibold">
            {p.name}: ${fmt(p.value)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
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
                <p className="text-xl font-bold font-mono-nums text-foreground mt-1">${fmt(data.totalAnnualIncome)}</p>
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
                      {nextUp.nextPayment > 0 && (
                        <span className="ml-2 text-base text-up">${fmt(nextUp.nextPayment)}</span>
                      )}
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

      {/* Tabs: Overview vs Calculator */}
      <Tabs defaultValue="overview">
        <TabsList className="h-8">
          <TabsTrigger value="overview" className="text-xs px-4">Overview</TabsTrigger>
          <TabsTrigger value="calculator" className="text-xs px-4">Calculator</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
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
                      return <Cell key={i} fill={isCurrentMonth ? "hsl(145 63% 42%)" : "hsl(210 100% 56%)"} opacity={d.income > 0 ? 1 : 0.25} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Holdings Table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">Dividend Holdings</CardTitle>
                <div className="flex items-center gap-1">
                  {(["income", "yield", "date"] as const).map(s => (
                    <button
                      key={s}
                      data-testid={`btn-sort-${s}`}
                      onClick={() => setSortBy(s)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap",
                        sortBy === s
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {s === "income" ? "Income" : s === "yield" ? "Yield" : "Date"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-border/50">
                {sorted.map(h => {
                  const days = daysUntil(h.nextPaymentDate);
                  return (
                    <div key={h.id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground text-sm">{h.ticker}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{h.shares.toLocaleString()} shares</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px] px-1.5" style={{ color: FREQ_COLORS[h.payoutFrequency] }}>
                            {freqLabel(h.payoutFrequency)}
                          </Badge>
                          <span className="text-sm font-bold text-up font-mono-nums">${fmt(h.annualIncome)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                        <span>Yield <span className="font-mono-nums text-up font-semibold">{fmt(h.dividendYield * 100, 2)}%</span></span>
                        <span>Rate <span className="font-mono-nums text-foreground">${fmt(h.dividendRate, 3)}</span></span>
                        <div className="text-right">
                          <div>{fmtDate(h.nextPaymentDate)}</div>
                          {days !== null && days >= 0 && days <= 60 && (
                            <div className="text-[10px] text-primary font-semibold">in {days}d</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {nonPaying.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wide bg-accent/30">
                      Non-dividend paying
                    </div>
                    {nonPaying.map(h => (
                      <div key={h.id} className="px-4 py-2.5 flex items-center justify-between opacity-50">
                        <span className="font-semibold text-foreground text-sm">{h.ticker}</span>
                        <span className="text-xs text-muted-foreground">No dividend</span>
                      </div>
                    ))}
                  </>
                )}
                {payingHoldings.length > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between border-t-2 border-border bg-accent/30">
                    <span className="text-sm font-semibold text-foreground">Total Annual Income</span>
                    <span className="text-sm font-bold text-up font-mono-nums">${fmt(data.totalAnnualIncome)}</span>
                  </div>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
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
                          <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">{h.shares.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-mono-nums">${fmt(h.dividendRate, 3)}</td>
                          <td className="px-4 py-2.5 text-right font-mono-nums text-up font-semibold">{fmt(h.dividendYield * 100, 2)}%</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant="secondary" className="text-[10px] px-1.5" style={{ color: FREQ_COLORS[h.payoutFrequency] }}>
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
                  {payingHoldings.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-accent/30">
                        <td className="px-4 py-2.5 font-semibold text-foreground" colSpan={7}>Total Annual Income</td>
                        <td className="px-4 py-2.5 text-right font-mono-nums font-bold text-up text-sm">${fmt(data.totalAnnualIncome)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CALCULATOR TAB ── */}
        <TabsContent value="calculator" className="space-y-5 mt-4">

          {/* Income Goal */}
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Income Goal</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Monthly passive income target ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 2000"
                    value={goalIncome}
                    onChange={e => setGoalIncome(e.target.value)}
                    className="h-8 text-sm w-40 font-mono-nums"
                  />
                </div>
                {goalMonthly > 0 && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">
                        ${fmt(currentMonthly)}/mo of ${fmt(goalMonthly)}/mo goal
                      </span>
                      <span className={cn("font-semibold", goalProgress >= 100 ? "text-up" : "text-foreground")}>
                        {fmt(goalProgress, 0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-accent overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${goalProgress}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {goalProgress >= 100
                        ? <span className="text-up font-semibold">You've reached your goal!</span>
                        : goalYear
                          ? <>On track to reach goal in <span className="font-semibold text-foreground">{new Date().getFullYear() + goalYear}</span> (Year {goalYear}){drip && " with DRIP"}</>
                          : <span>Increase horizon or enable DRIP to see goal date</span>
                      }
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Projection Controls */}
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Horizon slider */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Projection horizon</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={1} max={30} step={1}
                      value={[horizon]}
                      onValueChange={([v]) => setHorizon(v)}
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold w-12 text-right font-mono-nums">{horizon} yr</span>
                  </div>
                </div>

                {/* DRIP toggle */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">DRIP (reinvest dividends)</Label>
                  <button
                    onClick={() => setDrip(v => !v)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                      drip
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "text-muted-foreground border-border hover:bg-accent"
                    )}
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                    {drip ? "DRIP On" : "DRIP Off"}
                  </button>
                </div>

                {/* Monthly contribution */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Monthly contribution ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={monthlyContrib}
                    onChange={e => setMonthlyContrib(e.target.value)}
                    className="h-8 text-sm font-mono-nums"
                  />
                </div>

                {/* Growth rate override */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Growth rate override (%/yr)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Use per-stock CAGR"
                    value={growthOverride}
                    onChange={e => setGrowthOverride(e.target.value)}
                    className="h-8 text-sm font-mono-nums"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projection Chart */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Projected Annual Dividend Income</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {drip || parseFloat(monthlyContrib) > 0
                  ? "With your settings vs. baseline (no DRIP, no contributions)"
                  : "Based on historical dividend growth rates"
                }
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {growthLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : projections.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  No dividend-paying holdings to project
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {(drip || parseFloat(monthlyContrib) > 0) && (
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="withSettings"
                      name={drip || parseFloat(monthlyContrib) > 0 ? "With settings" : "Projected income"}
                      stroke="hsl(210 100% 56%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    {(drip || parseFloat(monthlyContrib) > 0) && (
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        name="Baseline"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Projection Table */}
          {projections.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Year-by-Year Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left text-muted-foreground font-medium">Year</th>
                        <th className="px-4 py-2 text-right text-muted-foreground font-medium">Annual Income</th>
                        <th className="px-4 py-2 text-right text-muted-foreground font-medium">Monthly Equiv</th>
                        <th className="px-4 py-2 text-right text-muted-foreground font-medium">Cumulative</th>
                        <th className="px-4 py-2 text-right text-muted-foreground font-medium">Growth vs Today</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projections.map(p => {
                        const growth = data.totalAnnualIncome > 0
                          ? ((p.income - data.totalAnnualIncome) / data.totalAnnualIncome) * 100
                          : 0;
                        const prevIncome = projections[p.year - 2]?.income ?? 0;
                        const isGoalYear = goalMonthly > 0 && p.income / 12 >= goalMonthly && prevIncome / 12 < goalMonthly;
                        return (
                          <tr
                            key={p.year}
                            className={cn("border-b border-border/50 hover:bg-accent/50 transition-colors", isGoalYear && "bg-primary/5")}
                          >
                            <td className="px-4 py-2.5 font-semibold">
                              {new Date().getFullYear() + p.year}
                              {isGoalYear && (
                                <span className="ml-1.5 text-[10px] text-primary font-semibold bg-primary/10 px-1 py-0.5 rounded">Goal ✓</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-nums font-semibold text-up">${fmt(p.income)}</td>
                            <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">${fmt(p.income / 12)}</td>
                            <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">${fmt(p.cumulative, 0)}</td>
                            <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", growth >= 0 ? "text-up" : "text-down")}>
                              {growth >= 0 ? "+" : ""}{fmt(growth, 0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-holding Growth Analysis */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Dividend Growth Analysis</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Historical dividend CAGR per holding</p>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {growthLoading ? (
                <div className="px-4 py-6 space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !growthData || growthData.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                  No dividend-paying holdings found
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-border/50">
                    {growthData.map(h => {
                      const sig = growthSignal(h.cagr3yr ?? h.cagr1yr);
                      return (
                        <div key={h.ticker} className="px-4 py-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-sm text-foreground">{h.ticker}</span>
                              <span className={cn("ml-2 flex-inline items-center gap-0.5 text-xs font-medium", sig.color)}>
                                {sig.label}
                              </span>
                            </div>
                            {h.streak > 0 && (
                              <span className="text-xs text-muted-foreground">{h.streak}yr streak</span>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>1yr <span className={cn("font-mono-nums font-semibold", h.cagr1yr !== null && h.cagr1yr > 0 ? "text-up" : h.cagr1yr !== null && h.cagr1yr < 0 ? "text-down" : "")}>{cagrLabel(h.cagr1yr)}</span></span>
                            <span>3yr <span className={cn("font-mono-nums font-semibold", h.cagr3yr !== null && h.cagr3yr > 0 ? "text-up" : h.cagr3yr !== null && h.cagr3yr < 0 ? "text-down" : "")}>{cagrLabel(h.cagr3yr)}</span></span>
                            <span>5yr <span className={cn("font-mono-nums font-semibold", h.cagr5yr !== null && h.cagr5yr > 0 ? "text-up" : h.cagr5yr !== null && h.cagr5yr < 0 ? "text-down" : "")}>{cagrLabel(h.cagr5yr)}</span></span>
                            <span>Yield <span className="font-mono-nums text-up font-semibold">{fmt(h.dividendYield * 100, 2)}%</span></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left text-muted-foreground font-medium">Ticker</th>
                          <th className="px-4 py-2 text-right text-muted-foreground font-medium">Yield</th>
                          <th className="px-4 py-2 text-right text-muted-foreground font-medium">Annual Income</th>
                          <th className="px-4 py-2 text-center text-muted-foreground font-medium">Signal</th>
                          <th className="px-4 py-2 text-right text-muted-foreground font-medium">1yr CAGR</th>
                          <th className="px-4 py-2 text-right text-muted-foreground font-medium">3yr CAGR</th>
                          <th className="px-4 py-2 text-right text-muted-foreground font-medium">5yr CAGR</th>
                          <th className="px-4 py-2 text-center text-muted-foreground font-medium">Streak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {growthData.map(h => {
                          const sig = growthSignal(h.cagr3yr ?? h.cagr1yr);
                          return (
                            <tr key={h.ticker} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-foreground">{h.ticker}</div>
                                <div className="text-muted-foreground text-[10px] truncate max-w-[120px]">{h.name}</div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono-nums text-up font-semibold">
                                {fmt(h.dividendYield * 100, 2)}%
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono-nums text-up font-semibold">
                                ${fmt(h.annualIncome)}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn("flex items-center justify-center gap-1 font-medium", sig.color)}>
                                  {sig.icon}{sig.label}
                                </span>
                              </td>
                              <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", h.cagr1yr !== null && h.cagr1yr > 0 ? "text-up" : h.cagr1yr !== null && h.cagr1yr < 0 ? "text-down" : "text-muted-foreground")}>
                                {cagrLabel(h.cagr1yr)}
                              </td>
                              <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", h.cagr3yr !== null && h.cagr3yr > 0 ? "text-up" : h.cagr3yr !== null && h.cagr3yr < 0 ? "text-down" : "text-muted-foreground")}>
                                {cagrLabel(h.cagr3yr)}
                              </td>
                              <td className={cn("px-4 py-2.5 text-right font-mono-nums font-semibold", h.cagr5yr !== null && h.cagr5yr > 0 ? "text-up" : h.cagr5yr !== null && h.cagr5yr < 0 ? "text-down" : "text-muted-foreground")}>
                                {cagrLabel(h.cagr5yr)}
                              </td>
                              <td className="px-4 py-2.5 text-center text-muted-foreground">
                                {h.streak > 0
                                  ? <span className="text-up font-semibold">{h.streak}yr ↑</span>
                                  : "—"
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}

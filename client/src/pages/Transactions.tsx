import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Loader2, CheckCircle2, BookOpen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, fmt } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@shared/schema";

const today = () => new Date().toISOString().split("T")[0];

const typeColors: Record<string, string> = {
  BUY: "bg-green-500/15 text-green-600 dark:text-green-400",
  SELL: "bg-red-500/15 text-red-400",
  SELL_ALL: "bg-red-500/15 text-red-400",
};

interface ManualForm {
  ticker: string;
  name: string;
  type: string;
  shares: string;
  price: string;
  date: string;
  notes: string;
}

const emptyForm = (): ManualForm => ({
  ticker: "", name: "", type: "BUY", shares: "", price: "", date: today(), notes: "",
});

export default function Transactions() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyForm());
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: summary } = useQuery<{ totalPnl: number; totalRealizedPnl?: number }>({
    queryKey: ["/api/portfolio/summary"],
    staleTime: 60_000,
  });

  const realizedTrades = useMemo(() =>
    transactions.filter(tx => (tx.type === "SELL" || tx.type === "SELL_ALL") && tx.realizedPnl != null),
    [transactions]
  );

  const monthlyRealized = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("en-US", { month: "short" });
      months[key] = 0;
    }
    transactions.forEach(tx => {
      if (tx.realizedPnl == null) return;
      const d = new Date(tx.date + "T12:00:00Z");
      const key = d.toLocaleString("en-US", { month: "short" });
      if (key in months) months[key] += tx.realizedPnl;
    });
    return Object.entries(months).map(([label, value]) => ({ label, value }));
  }, [transactions]);

  const maxMonthly = Math.max(...monthlyRealized.map(m => Math.abs(m.value)), 1);
  const unrealizedPnl = summary?.totalPnl ?? 0;
  const realizedPnl = summary?.totalRealizedPnl ?? 0;
  const combinedPnl = unrealizedPnl + realizedPnl;

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setForm(emptyForm());
      setShowForm(false);
      setLookupStatus("idle");
      toast({ title: "Transaction logged" });
    },
    onError: () => toast({ title: "Failed to log transaction", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setConfirmDeleteId(null);
      toast({ title: "Transaction deleted and portfolio reversed" });
    },
    onError: () => toast({ title: "Failed to delete transaction", variant: "destructive" }),
  });

  // Cleanup timer on unmount
  useEffect(() => () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current); }, []);

  const set = (k: keyof ManualForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleTickerChange = (raw: string) => {
    const ticker = raw.toUpperCase();
    set("ticker", ticker);
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (ticker.length < 1) { setLookupStatus("idle"); return; }
    setLookupStatus("loading");
    lookupTimerRef.current = setTimeout(async () => {
      try {
        // Fetch name + sector from lookup, and current price in parallel
        const [lookupRes, priceRes] = await Promise.all([
          fetch(`/api/lookup/${ticker}`, { credentials: "include" }),
          fetch(`/api/prices/${ticker}`, { credentials: "include" }),
        ]);
        if (!lookupRes.ok) { setLookupStatus("notfound"); return; }
        const lookup = await lookupRes.json();
        const priceData = priceRes.ok ? await priceRes.json() : null;
        setForm(f => ({
          ...f,
          ticker,
          name: lookup.name || f.name,
          // Only auto-fill price if user hasn't typed one yet
          price: f.price === "" && priceData?.price ? String(priceData.price.toFixed(2)) : f.price,
        }));
        setLookupStatus("found");
      } catch {
        setLookupStatus("notfound");
      }
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shares = parseFloat(form.shares);
    const price = parseFloat(form.price);
    if (isNaN(shares) || isNaN(price)) {
      toast({ title: "Shares and price must be numbers", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ticker: form.ticker.toUpperCase(),
      name: form.name || form.ticker.toUpperCase(),
      type: form.type,
      shares,
      price,
      totalValue: shares * price,
      date: form.date,
      notes: form.notes,
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {transactions.length} trade{transactions.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <Button
          size="sm"
          className="text-xs h-7 px-2.5"
          onClick={() => setShowForm(v => !v)}
        >
          <Plus className="w-3 h-3 mr-1.5" />
          Manual Entry
        </Button>
      </div>

      {/* Manual Entry Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Log Manual Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="tx-ticker">Ticker</Label>
                  <div className="relative">
                    <Input
                      id="tx-ticker"
                      value={form.ticker}
                      onChange={e => handleTickerChange(e.target.value)}
                      placeholder="NVDA"
                      required
                      className="h-8 text-sm uppercase pr-7"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {lookupStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      {lookupStatus === "found" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                  </div>
                  {lookupStatus === "notfound" && (
                    <p className="text-xs text-muted-foreground">Ticker not found — enter name manually</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="tx-name">Company Name</Label>
                  <Input
                    id="tx-name"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="Auto-filled from ticker"
                    className={cn("h-8 text-sm", lookupStatus === "found" && form.name ? "border-green-600/50" : "")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={form.type} onValueChange={v => set("type", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                      <SelectItem value="SELL_ALL">SELL ALL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="tx-shares">Shares</Label>
                  <Input
                    id="tx-shares"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={form.shares}
                    onChange={e => set("shares", e.target.value)}
                    placeholder="100"
                    required
                    className="h-8 text-sm font-mono-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="tx-price">Price ($)</Label>
                  <Input
                    id="tx-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.price}
                    onChange={e => set("price", e.target.value)}
                    placeholder="Auto-filled from ticker"
                    required
                    className={cn("h-8 text-sm font-mono-nums", lookupStatus === "found" && form.price ? "border-green-600/50" : "")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="tx-date">Date</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    value={form.date}
                    onChange={e => set("date", e.target.value)}
                    required
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="tx-notes">Notes (optional)</Label>
                <Input
                  id="tx-notes"
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Investment thesis..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(emptyForm()); setLookupStatus("idle"); }}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Log Transaction"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* P&L Breakdown — only shown when there are realized trades */}
      {realizedTrades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: P&L Summary */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">P&L Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1">
                {[
                  { label: "Unrealized gains", value: unrealizedPnl, dot: "bg-up" },
                  { label: "Realized gains", value: realizedPnl, dot: "bg-indigo-500" },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/50">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                      {label}
                    </span>
                    <span className={cn("font-mono-nums text-sm font-medium", value >= 0 ? "text-up" : "text-down")}>
                      {value >= 0 ? "+" : ""}${fmt(Math.abs(value))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm font-semibold">Total Return</span>
                  <span className={cn("font-mono-nums text-lg font-semibold", combinedPnl >= 0 ? "text-up" : "text-down")}>
                    {combinedPnl >= 0 ? "+" : ""}${fmt(Math.abs(combinedPnl))}
                  </span>
                </div>
              </div>
              {/* Monthly realized bar chart */}
              {realizedPnl !== 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-3">Monthly realized (last 6 months)</p>
                  <div className="flex items-end gap-1.5 h-12">
                    {monthlyRealized.map(({ label, value }) => {
                      const h = Math.max((Math.abs(value) / maxMonthly) * 48, value !== 0 ? 3 : 1);
                      return (
                        <div key={label} className="flex flex-col items-center gap-1 flex-1">
                          <div
                            className={cn("w-full rounded-t-sm transition-all", value > 0 ? "bg-up/60" : value < 0 ? "bg-down/60" : "bg-muted")}
                            style={{ height: h }}
                          />
                          <span className="text-[9px] text-muted-foreground">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Realized Trades */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                Realized Trades
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Ticker</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-medium">Shares</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-medium">Sell Price</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-medium">Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {realizedTrades.slice(0, 6).map(tx => (
                    <tr key={tx.id} className="border-b border-border/40 hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-foreground">{tx.ticker}</div>
                        <div className="text-muted-foreground truncate max-w-[110px]">{tx.name}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">{fmt(tx.shares, 0)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-nums text-muted-foreground">${fmt(tx.price)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-nums font-medium">
                        <span className={tx.realizedPnl! >= 0 ? "text-up" : "text-down"}>
                          {tx.realizedPnl! >= 0 ? "+" : ""}${fmt(Math.abs(tx.realizedPnl!))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Ticker</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Shares</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Total Value</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Realized P&L</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Notes</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : transactions.length === 0
                    ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                          No transactions yet. Add a holding to auto-log a BUY.
                        </td>
                      </tr>
                    )
                    : transactions.map(tx => (
                        <tr key={tx.id} className="group border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(tx.date + "T12:00:00Z").toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric"
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{tx.ticker}</div>
                            <div className="text-muted-foreground truncate max-w-[130px]">{tx.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", typeColors[tx.type] ?? "bg-accent text-foreground")}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono-nums">{fmt(tx.shares, 0)}</td>
                          <td className="px-4 py-3 text-right font-mono-nums">${fmt(tx.price)}</td>
                          <td className="px-4 py-3 text-right font-mono-nums">${fmt(tx.totalValue)}</td>
                          <td className="px-4 py-3 text-right font-mono-nums">
                            {(tx.type === "SELL" || tx.type === "SELL_ALL") && tx.realizedPnl != null ? (
                              <span className={tx.realizedPnl >= 0 ? "text-up" : "text-down"}>
                                {tx.realizedPnl >= 0 ? "+" : ""}${fmt(tx.realizedPnl)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{tx.notes || "-"}</td>
                          <td className="px-4 py-3 text-right">
                            {confirmDeleteId === tx.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => deleteMutation.mutate(tx.id)}
                                  disabled={deleteMutation.isPending}
                                  className="text-[10px] font-medium text-red-500 hover:text-red-400 disabled:opacity-50"
                                >
                                  {deleteMutation.isPending ? "..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Realized P&L Summary Footer */}
      {(() => {
        const sells = transactions.filter(tx => (tx.type === "SELL" || tx.type === "SELL_ALL") && tx.realizedPnl != null);
        if (sells.length === 0) return null;
        const totalRealized = sells.reduce((s, tx) => s + (tx.realizedPnl ?? 0), 0);
        const wins = sells.filter(tx => (tx.realizedPnl ?? 0) > 0).length;
        const losses = sells.filter(tx => (tx.realizedPnl ?? 0) < 0).length;
        const breakeven = sells.length - wins - losses;
        return (
          <Card>
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Realized P&L</p>
                  <p className={cn("text-2xl font-semibold font-mono-nums", totalRealized >= 0 ? "text-up" : "text-down")}>
                    {totalRealized >= 0 ? "+" : ""}${fmt(totalRealized)}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Winning</p>
                    <p className="text-lg font-semibold font-mono-nums text-up">{wins}W</p>
                  </div>
                  {breakeven > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Breakeven</p>
                      <p className="text-lg font-semibold font-mono-nums text-muted-foreground">{breakeven}B</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Losing</p>
                    <p className="text-lg font-semibold font-mono-nums text-down">{losses}L</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                    <p className="text-lg font-semibold font-mono-nums text-foreground">
                      {sells.length > 0 ? Math.round((wins / sells.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

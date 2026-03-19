import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Pencil, Bell, BellOff, Eye, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn, fmt } from "@/lib/utils";
import type { WatchlistItem, InsertWatchlistItem } from "@shared/schema";

interface PriceData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high52w?: number;
  low52w?: number;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const W = 88, H = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const toX = (i: number) => (i / (data.length - 1)) * W;
  const toY = (v: number) => H - ((v - min) / range) * (H - 4) - 2;

  const pts = data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const area = `M0,${H} ${data.map((v, i) => `L${toX(i)},${toY(v)}`).join(" ")} L${W},${H} Z`;
  const color = positive ? "hsl(145 63% 42%)" : "hsl(0 91% 71%)";
  const gradId = `sg-${data[0].toFixed(0)}-${data[data.length - 1].toFixed(0)}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

// ── Price range bar ───────────────────────────────────────────────────────────

function PriceRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const pad = (high - low) * 0.15 || current * 0.05;
  const min = low - pad;
  const max = high + pad;
  const span = max - min;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / span) * 100))}%`;

  return (
    <div className="relative h-7 mt-1">
      {/* Track */}
      <div className="absolute top-[13px] left-0 right-0 h-[3px] rounded-full bg-muted" />
      {/* Range fill */}
      <div
        className="absolute top-[13px] h-[3px] rounded-full bg-amber-400/50"
        style={{ left: pct(low), width: `${((high - low) / span) * 100}%` }}
      />
      {/* Current price cursor */}
      <div
        className="absolute top-[7px] w-[3px] h-[15px] rounded-full bg-foreground shadow-sm"
        style={{ left: pct(current), transform: "translateX(-1.5px)" }}
      />
      {/* Labels */}
      <span className="absolute top-0 text-[9px] text-muted-foreground/60 font-mono-nums" style={{ left: pct(low), transform: "translateX(-50%)" }}>
        ${low % 1 === 0 ? low : fmt(low)}
      </span>
      <span className="absolute top-0 text-[9px] text-muted-foreground/60 font-mono-nums" style={{ left: pct(high), transform: "translateX(-50%)" }}>
        ${high % 1 === 0 ? high : fmt(high)}
      </span>
    </div>
  );
}

// ── Watchlist form ────────────────────────────────────────────────────────────

const emptyForm = (): Partial<InsertWatchlistItem> => ({
  ticker: "", name: "", alertLow: undefined, alertHigh: undefined, notes: "",
});

interface WatchlistFormProps {
  initial?: WatchlistItem;
  onSubmit: (data: InsertWatchlistItem) => void;
  onCancel: () => void;
  loading?: boolean;
}

function WatchlistForm({ initial, onSubmit, onCancel, loading }: WatchlistFormProps) {
  const [form, setForm] = useState<Partial<InsertWatchlistItem>>(
    initial
      ? { ticker: initial.ticker, name: initial.name, alertLow: initial.alertLow ?? undefined, alertHigh: initial.alertHigh ?? undefined, notes: initial.notes ?? "" }
      : emptyForm()
  );
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (k: keyof InsertWatchlistItem, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleTickerChange = (raw: string) => {
    const ticker = raw.toUpperCase();
    set("ticker", ticker);
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (ticker.length < 1) { setLookupStatus("idle"); return; }
    setLookupStatus("loading");
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lookup/${ticker}`, { credentials: "include" });
        if (!res.ok) { setLookupStatus("notfound"); return; }
        const data = await res.json();
        setForm(f => ({ ...f, ticker, name: data.name || f.name }));
        setLookupStatus("found");
      } catch { setLookupStatus("notfound"); }
    }, 600);
  };

  useEffect(() => () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ticker: form.ticker!.toUpperCase(),
      name: form.name || form.ticker!,
      alertLow: form.alertLow ? Number(form.alertLow) : null,
      alertHigh: form.alertHigh ? Number(form.alertHigh) : null,
      notes: form.notes || "",
      addedAt: initial?.addedAt || new Date().toISOString(),
    } as InsertWatchlistItem);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wl-ticker">Ticker</Label>
          <div className="relative">
            <Input id="wl-ticker" data-testid="input-wl-ticker" value={form.ticker ?? ""} onChange={e => handleTickerChange(e.target.value)} placeholder="CELH" required className="h-8 text-sm uppercase pr-7" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {lookupStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              {lookupStatus === "found" && <CheckCircle2 className="w-3.5 h-3.5 text-up" />}
            </div>
          </div>
          {lookupStatus === "notfound" && <p className="text-xs text-muted-foreground">Not found — enter name manually</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wl-name">Company Name</Label>
          <Input id="wl-name" data-testid="input-wl-name" value={form.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="Auto-filled from ticker" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wl-low">Alert Low ($)</Label>
          <Input id="wl-low" data-testid="input-wl-low" type="number" step="0.01" value={form.alertLow ?? ""} onChange={e => set("alertLow", e.target.value)} placeholder="25.00" className="h-8 text-sm font-mono-nums" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wl-high">Alert High ($)</Label>
          <Input id="wl-high" data-testid="input-wl-high" type="number" step="0.01" value={form.alertHigh ?? ""} onChange={e => set("alertHigh", e.target.value)} placeholder="50.00" className="h-8 text-sm font-mono-nums" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wl-notes">Notes (optional)</Label>
        <Input id="wl-notes" data-testid="input-wl-notes" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="Why you're watching..." className="h-8 text-sm" />
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button data-testid="btn-submit-watchlist" type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : initial ? "Update" : "Add to Watchlist"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Watchlist card ────────────────────────────────────────────────────────────

interface WatchlistCardProps {
  item: WatchlistItem;
  pd?: PriceData;
  chartData?: number[];
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function WatchlistCard({ item, pd, chartData, index, onEdit, onDelete }: WatchlistCardProps) {
  const price = pd?.price;
  const changePercent = pd?.changePercent ?? 0;
  const positive = changePercent >= 0;

  const atLow = !!(item.alertLow && price && price <= item.alertLow);
  const atHigh = !!(item.alertHigh && price && price >= item.alertHigh);
  const alertTriggered = atLow || atHigh;
  const hasAlert = !!(item.alertLow || item.alertHigh);

  const sparkline = chartData ?? null;

  // Range bar data: prefer alert thresholds, fall back to 52w range
  const rangeLow = item.alertLow ?? pd?.low52w;
  const rangeHigh = item.alertHigh ?? pd?.high52w;
  const showRange = rangeLow != null && rangeHigh != null && price != null && rangeHigh > rangeLow;

  return (
    <div
      data-testid={`watchlist-card-${item.id}`}
      className={cn(
        "group relative flex flex-col sm:grid sm:grid-cols-[minmax(160px,1.5fr)_minmax(100px,1fr)_auto_minmax(160px,1.5fr)] items-center gap-x-6 gap-y-3",
        "bg-card/60 border rounded-xl px-5 py-4 transition-all duration-300",
        "hover:-translate-y-px hover:shadow-md hover:bg-card hover:border-border/80",
        alertTriggered
          ? "border-amber-500/40 border-l-2 border-l-amber-500"
          : "border-border/50",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Col 1: Ticker info */}
      <div className="w-full sm:w-auto">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-bold tracking-tight text-foreground">{item.ticker}</span>
          {alertTriggered && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/20">
              {atLow ? "↓ Low" : "↑ High"}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{item.name}</div>
        {item.notes && (
          <div className="text-[10px] text-muted-foreground/50 italic mt-1 truncate max-w-[180px]">{item.notes}</div>
        )}
      </div>

      {/* Col 2: Price + change */}
      <div className="w-full sm:w-auto">
        {price ? (
          <>
            <div className="text-xl font-semibold font-mono-nums text-foreground tracking-tight">
              ${fmt(price)}
            </div>
            <div className={cn("text-xs font-mono-nums font-medium mt-0.5", positive ? "text-up" : "text-down")}>
              {positive ? "+" : ""}{fmt(changePercent)}%
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        )}
      </div>

      {/* Col 3: Sparkline */}
      <div className="hidden sm:flex justify-center">
        {sparkline ? (
          <Sparkline data={sparkline} positive={positive} />
        ) : (
          <div className="w-[88px] h-9 flex items-center justify-center">
            <Skeleton className="h-3 w-full" />
          </div>
        )}
      </div>

      {/* Col 4: Range bar / Alert thresholds */}
      <div className="w-full sm:w-auto">
        {showRange ? (
          <>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5 font-medium">
              {item.alertLow || item.alertHigh ? "Alert range" : "52w range"}
            </div>
            <PriceRangeBar low={rangeLow!} high={rangeHigh!} current={price!} />
          </>
        ) : hasAlert ? (
          <div className="flex flex-col gap-1 text-xs">
            {item.alertLow && (
              <span className={cn("flex items-center gap-1", atLow ? "text-down font-semibold" : "text-muted-foreground")}>
                <Bell className="w-3 h-3 shrink-0" />
                Below ${fmt(item.alertLow)}
              </span>
            )}
            {item.alertHigh && (
              <span className={cn("flex items-center gap-1", atHigh ? "text-up font-semibold" : "text-muted-foreground")}>
                <Bell className="w-3 h-3 shrink-0" />
                Above ${fmt(item.alertHigh)}
              </span>
            )}
          </div>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
            <BellOff className="w-3 h-3" />
            No alerts set
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          data-testid={`btn-edit-wl-${item.id}`}
          onClick={onEdit}
          className="w-7 h-7 rounded-lg border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          data-testid={`btn-delete-wl-${item.id}`}
          onClick={onDelete}
          className="w-7 h-7 rounded-lg border border-border/60 bg-background/80 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Watchlist() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({ queryKey: ["/api/watchlist"] });

  const tickers = watchlist.map(w => w.ticker);

  const { data: prices = {} } = useQuery<Record<string, PriceData>>({
    queryKey: ["/api/prices/batch", tickers.join(",")],
    queryFn: () => tickers.length > 0
      ? fetch("/api/prices/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers }), credentials: "include" }).then(r => r.json())
      : Promise.resolve({}),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
  });

  const { data: charts = {} } = useQuery<Record<string, number[]>>({
    queryKey: ["/api/prices/charts", tickers.join(",")],
    queryFn: () => tickers.length > 0
      ? fetch("/api/prices/charts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers }), credentials: "include" }).then(r => r.json())
      : Promise.resolve({}),
    enabled: tickers.length > 0,
    staleTime: 10 * 60_000, // chart data is stable, refresh every 10 min
  });

  const addMutation = useMutation({
    mutationFn: (data: InsertWatchlistItem) => apiRequest("POST", "/api/watchlist", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }); setShowAdd(false); toast({ title: "Added to watchlist" }); },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertWatchlistItem> }) => apiRequest("PUT", `/api/watchlist/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }); setEditId(null); toast({ title: "Updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/watchlist/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }); setDeleteId(null); toast({ title: "Removed from watchlist" }); },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const editItem = watchlist.find(w => w.id === editId);

  const triggeredAlerts = watchlist.filter(w => {
    const p = prices[w.ticker]?.price;
    if (!p) return false;
    return (w.alertLow && p <= w.alertLow) || (w.alertHigh && p >= w.alertHigh);
  });

  const totalWatchlistValue = watchlist.reduce((s, w) => s + (prices[w.ticker]?.price ?? 0), 0);
  const hasAlerts = watchlist.filter(w => w.alertLow || w.alertHigh).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Watchlist</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {watchlist.length} stock{watchlist.length !== 1 ? "s" : ""} tracked
            {triggeredAlerts.length > 0 && (
              <span className="ml-1.5 text-amber-500 font-medium">· {triggeredAlerts.length} alert{triggeredAlerts.length > 1 ? "s" : ""} triggered</span>
            )}
          </p>
        </div>
        <Button data-testid="btn-add-watchlist" size="sm" className="text-xs h-7 px-2.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1.5" />
          Add stock
        </Button>
      </div>

      {/* Summary strip */}
      {watchlist.length > 0 && (
        <div className="grid grid-cols-3 divide-x divide-border border border-border/50 rounded-xl overflow-hidden bg-muted/20">
          {[
            { label: "Watching", value: String(watchlist.length) },
            { label: "Combined value", value: totalWatchlistValue > 0 ? `$${fmt(totalWatchlistValue)}` : "—" },
            { label: "Alerts set", value: String(hasAlerts), accent: triggeredAlerts.length > 0 },
          ].map(({ label, value, accent }) => (
            <div key={label} className="py-4 px-5 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium mb-1.5">{label}</div>
              <div className={cn("text-xl font-semibold font-mono-nums", accent ? "text-amber-500" : "text-foreground")}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card list */}
      <div className="space-y-2.5">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          : watchlist.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Eye className="w-10 h-10 text-muted-foreground/20 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">Nothing on your watchlist yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Add stocks you're watching to track prices and set alerts</p>
                <Button size="sm" className="text-xs" onClick={() => setShowAdd(true)}>
                  <Plus className="w-3 h-3 mr-1.5" />
                  Add your first stock
                </Button>
              </div>
            )
            : watchlist.map((item, i) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  pd={prices[item.ticker]}
                  chartData={charts[item.ticker]}
                  index={i}
                  onEdit={() => setEditId(item.id)}
                  onDelete={() => setDeleteId(item.id)}
                />
              ))
        }
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm">Add to Watchlist</DialogTitle></DialogHeader>
          <WatchlistForm
            onSubmit={(data) => addMutation.mutate(data)}
            onCancel={() => setShowAdd(false)}
            loading={addMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm">Edit {editItem?.ticker}</DialogTitle></DialogHeader>
          {editItem && (
            <WatchlistForm
              initial={editItem}
              onSubmit={(data) => updateMutation.mutate({ id: editId!, data })}
              onCancel={() => setEditId(null)}
              loading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Remove from Watchlist?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{watchlist.find(w => w.id === deleteId)?.ticker}</strong> from your watchlist?
          </p>
          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              data-testid="btn-confirm-delete-wl"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteId!)}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

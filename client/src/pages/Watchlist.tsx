import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Pencil, Bell, BellOff, TrendingUp, TrendingDown, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { WatchlistItem, InsertWatchlistItem } from "@shared/schema";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface PriceData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high52w?: number;
  low52w?: number;
}

const emptyForm = (): Partial<InsertWatchlistItem> => ({
  ticker: "", name: "", alertLow: undefined, alertHigh: undefined, notes: ""
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
        const res = await fetch(`/api/lookup/${ticker}`);
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

function AlertStatus({ item, price }: { item: WatchlistItem; price?: number }) {
  if (!price || (!item.alertLow && !item.alertHigh)) return null;
  const atLow = item.alertLow && price <= item.alertLow;
  const atHigh = item.alertHigh && price >= item.alertHigh;
  if (atLow) return <span className="flex items-center gap-1 text-xs text-down font-medium"><Bell className="w-3 h-3" /> Below low alert</span>;
  if (atHigh) return <span className="flex items-center gap-1 text-xs text-up font-medium"><Bell className="w-3 h-3" /> Above high alert</span>;
  return null;
}

export default function Watchlist() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({ queryKey: ["/api/watchlist"] });

  // Fetch prices for all watchlist items
  const tickers = watchlist.map(w => w.ticker);
  const { data: prices = {} } = useQuery<Record<string, PriceData>>({
    queryKey: ["/api/prices/batch", tickers.join(",")],
    queryFn: () => tickers.length > 0
      ? fetch("/api/prices/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers }) }).then(r => r.json())
      : Promise.resolve({}),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
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

  // Count alerts triggered
  const triggeredAlerts = watchlist.filter(w => {
    const p = prices[w.ticker]?.price;
    if (!p) return false;
    return (w.alertLow && p <= w.alertLow) || (w.alertHigh && p >= w.alertHigh);
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Watchlist</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {watchlist.length} stocks · {triggeredAlerts.length > 0 && <span className="text-down font-medium">{triggeredAlerts.length} alert{triggeredAlerts.length > 1 ? "s" : ""} triggered</span>}
            {triggeredAlerts.length === 0 && "No alerts triggered"}
          </p>
        </div>
        <Button data-testid="btn-add-watchlist" size="sm" className="text-xs h-7 px-2.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1.5" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)
          : watchlist.map(item => {
              const pd = prices[item.ticker];
              const price = pd?.price;
              const change = pd?.changePercent;
              const atLow = item.alertLow && price && price <= item.alertLow;
              const atHigh = item.alertHigh && price && price >= item.alertHigh;
              const alertTriggered = atLow || atHigh;

              return (
                <Card
                  key={item.id}
                  data-testid={`watchlist-card-${item.id}`}
                  className={cn("relative", alertTriggered && "ring-1 ring-primary")}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-foreground text-sm">{item.ticker}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px]">{item.name}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditId(item.id)} data-testid={`btn-edit-wl-${item.id}`}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)} data-testid={`btn-delete-wl-${item.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {price ? (
                      <div className="flex items-end gap-2 mb-2">
                        <span className="font-mono-nums font-semibold text-lg text-foreground">${fmt(price)}</span>
                        <span className={cn("text-xs font-mono-nums mb-0.5", (change ?? 0) >= 0 ? "text-up" : "text-down")}>
                          {(change ?? 0) >= 0 ? "+" : ""}{fmt(change ?? 0)}%
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mb-2">Loading price...</div>
                    )}

                    {/* Alert thresholds */}
                    <div className="flex items-center gap-3 text-xs">
                      {item.alertLow && (
                        <span className={cn("flex items-center gap-1", atLow ? "text-down font-semibold" : "text-muted-foreground")}>
                          <TrendingDown className="w-3 h-3" />
                          ≤${fmt(item.alertLow)}
                        </span>
                      )}
                      {item.alertHigh && (
                        <span className={cn("flex items-center gap-1", atHigh ? "text-up font-semibold" : "text-muted-foreground")}>
                          <TrendingUp className="w-3 h-3" />
                          ≥${fmt(item.alertHigh)}
                        </span>
                      )}
                      {!item.alertLow && !item.alertHigh && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <BellOff className="w-3 h-3" />
                          No alerts set
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 truncate">{item.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

        {!isLoading && watchlist.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No stocks on your watchlist yet.</p>
            <Button size="sm" className="mt-3 text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="w-3 h-3 mr-1.5" />
              Add your first stock
            </Button>
          </div>
        )}
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
          <p className="text-sm text-muted-foreground">Remove <strong>{watchlist.find(w => w.id === deleteId)?.ticker}</strong> from your watchlist?</p>
          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId!)}>
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add missing import
function Eye(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

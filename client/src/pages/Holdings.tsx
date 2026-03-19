import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Upload, ChevronDown, ChevronUp, Loader2, CheckCircle2, Banknote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn, fmt } from "@/lib/utils";
import type { Holding, InsertHolding } from "@shared/schema";

const SECTORS = [
  "Semiconductors", "Software/AI", "Cloud/AI", "Cloud/E-commerce",
  "Automotive/EV", "Bitcoin Mining/AI", "Biotech", "Energy", "Finance",
  "Consumer", "Healthcare", "Industrial", "Real Estate", "Cash", "Other"
];

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = (): InsertHolding => ({
  ticker: "", name: "", shares: 0, avgCost: 0, sector: "Other", notes: "",
  purchaseDate: today(),
});

interface HoldingFormProps {
  initial?: Holding;
  onSubmit: (data: InsertHolding) => void;
  onCancel: () => void;
  loading?: boolean;
  isCashPreset?: boolean;
}

function HoldingForm({ initial, onSubmit, onCancel, loading, isCashPreset }: HoldingFormProps) {
  const isCashForm = isCashPreset || initial?.ticker === "CASH";

  const [form, setForm] = useState<InsertHolding>(
    initial
      ? {
          ticker: initial.ticker,
          name: initial.name,
          shares: initial.shares,
          avgCost: initial.avgCost,
          sector: initial.sector,
          notes: initial.notes ?? "",
          purchaseDate: initial.purchaseDate ?? today(),
        }
      : isCashPreset
        ? { ticker: "CASH", name: "Cash & Equivalents", shares: 0, avgCost: 1, sector: "Cash", notes: "", purchaseDate: today() }
        : emptyForm()
  );

  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof InsertHolding, v: any) => setForm(f => ({ ...f, [k]: v }));

  const fetchHistoricalPrice = async (ticker: string, date: string, currentAvgCost: number) => {
    if (!ticker || !date) return;
    try {
      const res = await fetch(`/api/prices/${ticker}/history?date=${date}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.price) {
        setForm(f => ({
          ...f,
          // Only auto-fill if user hasn't typed a value
          avgCost: (f.avgCost === 0 || f.avgCost === currentAvgCost) ? data.price : f.avgCost,
        }));
      }
    } catch { /* ignore */ }
  };

  // Auto-lookup when ticker changes (debounced 600ms, min 1 char) - skip for CASH
  const handleTickerChange = (raw: string) => {
    const ticker = raw.toUpperCase();
    set("ticker", ticker);
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (ticker === "CASH" || ticker.length < 1) { setLookupStatus("idle"); return; }
    setLookupStatus("loading");
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lookup/${ticker}`, { credentials: "include" });
        if (!res.ok) { setLookupStatus("notfound"); return; }
        const data = await res.json();
        setForm(f => {
          // Schedule historical price fetch after form state settles
          setTimeout(() => fetchHistoricalPrice(ticker, f.purchaseDate ?? today(), f.avgCost), 0);
          return {
            ...f,
            ticker,
            name: data.name || f.name,
            sector: data.sector || f.sector,
          };
        });
        setLookupStatus("found");
      } catch {
        setLookupStatus("notfound");
      }
    }, 600);
  };

  // Re-fetch historical price when purchaseDate changes (if ticker already found)
  const handleDateChange = (date: string) => {
    set("purchaseDate", date);
    if (lookupStatus !== "found" || !form.ticker) return;
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
    priceTimerRef.current = setTimeout(() => {
      fetchHistoricalPrice(form.ticker, date, form.avgCost);
    }, 400);
  };

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCashForm) {
      // CASH: shares = dollar amount, avgCost fixed at 1
      onSubmit({
        ...form,
        ticker: "CASH",
        name: form.name || "Cash & Equivalents",
        sector: "Cash",
        avgCost: 1,
        shares: Number(form.shares),
      });
    } else {
      onSubmit({ ...form, ticker: form.ticker.toUpperCase(), shares: Number(form.shares), avgCost: Number(form.avgCost) });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isCashForm ? (
        /* Simplified Cash form */
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Banknote className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Cash position - value tracks dollar amount directly</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="cash-amount">Amount ($)</Label>
              <Input
                id="cash-amount"
                data-testid="input-cash-amount"
                type="number"
                step="0.01"
                value={form.shares || ""}
                onChange={e => set("shares", e.target.value)}
                placeholder="10000.00"
                required
                min="0.01"
                className="h-8 text-sm font-mono-nums"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="cash-label">Label (optional)</Label>
              <Input
                id="cash-label"
                data-testid="input-cash-label"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Cash & Equivalents"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="cash-date">Date Added</Label>
              <Input
                id="cash-date"
                data-testid="input-cash-date"
                type="date"
                value={form.purchaseDate ?? today()}
                onChange={e => set("purchaseDate", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="cash-notes">Notes (optional)</Label>
              <Input
                id="cash-notes"
                data-testid="input-cash-notes"
                value={form.notes ?? ""}
                onChange={e => set("notes", e.target.value)}
                placeholder="e.g. Dry powder"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Regular stock form */
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ticker">Ticker</Label>
              <div className="relative">
                <Input
                  id="ticker"
                  data-testid="input-ticker"
                  value={form.ticker}
                  onChange={e => handleTickerChange(e.target.value)}
                  placeholder="NVDA"
                  required
                  className="h-8 text-sm uppercase pr-7"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {lookupStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  {lookupStatus === "found" && <CheckCircle2 className="w-3.5 h-3.5 text-up" />}
                </div>
              </div>
              {lookupStatus === "notfound" && (
                <p className="text-xs text-muted-foreground">Ticker not found - enter name manually</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="name">Company Name</Label>
              <Input
                id="name"
                data-testid="input-name"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Auto-filled from ticker"
                required
                className={cn("h-8 text-sm", lookupStatus === "found" && form.name ? "border-green-600/50" : "")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                data-testid="input-shares"
                type="number"
                step="0.001"
                value={form.shares || ""}
                onChange={e => set("shares", e.target.value)}
                placeholder="100"
                required
                min="0.001"
                className="h-8 text-sm font-mono-nums"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="avgcost">Avg Cost ($)</Label>
              <Input
                id="avgcost"
                data-testid="input-avgcost"
                type="number"
                step="0.01"
                value={form.avgCost || ""}
                onChange={e => set("avgCost", e.target.value)}
                placeholder="150.00"
                required
                min="0.01"
                className="h-8 text-sm font-mono-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Sector</Label>
              <Select value={form.sector ?? "Other"} onValueChange={v => set("sector", v)}>
                <SelectTrigger data-testid="select-sector" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                data-testid="input-purchase-date"
                type="date"
                value={form.purchaseDate ?? today()}
                onChange={e => handleDateChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              data-testid="input-notes"
              value={form.notes ?? ""}
              onChange={e => set("notes", e.target.value)}
              placeholder="Investment thesis..."
              className="h-8 text-sm"
            />
          </div>
        </>
      )}
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button data-testid="btn-submit-holding" type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : initial ? "Update" : (isCashForm ? "Add Cash" : "Add Holding")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Holdings() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCash, setShowAddCash] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<keyof Holding>("ticker");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: holdings = [], isLoading } = useQuery<Holding[]>({ queryKey: ["/api/holdings"] });

  const addMutation = useMutation({
    mutationFn: (data: InsertHolding) => apiRequest("POST", "/api/holdings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setShowAdd(false);
      setShowAddCash(false);
      toast({ title: "Holding added" });
    },
    onError: () => toast({ title: "Failed to add holding", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InsertHolding }) => apiRequest("PUT", `/api/holdings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setEditId(null);
      toast({ title: "Holding updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/holdings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setDeleteId(null);
      toast({ title: "Holding deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: (data: any[]) => apiRequest("POST", "/api/holdings/import", { rows: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Holdings imported" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const handleSort = (field: keyof Holding) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    if (a.ticker === "CASH" && b.ticker !== "CASH") return 1;
    if (b.ticker === "CASH" && a.ticker !== "CASH") return -1;
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Separate cash and non-cash for stats
  const nonCash = holdings.filter(h => h.ticker !== "CASH");
  const cashHoldings = holdings.filter(h => h.ticker === "CASH");
  const totalCost = nonCash.reduce((s, h) => s + h.avgCost * h.shares, 0);
  const totalCashValue = cashHoldings.reduce((s, h) => s + h.shares, 0);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) { toast({ title: "CSV must have a header row", variant: "destructive" }); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",");
        const row: any = {};
        headers.forEach((h, i) => row[h] = vals[i]?.trim() ?? "");
        return {
          ticker: row.ticker || row.symbol,
          name: row.name || row.company || row.ticker || row.symbol,
          shares: parseFloat(row.shares || row.quantity || "0"),
          avgCost: parseFloat(row.avg_cost || row.cost || row.purchase_price || row.price || "0"),
          sector: row.sector || "Other",
          notes: row.notes || "",
          purchaseDate: row.purchase_date || row.date || null,
        };
      }).filter(r => r.ticker && r.shares > 0 && r.avgCost > 0);
      if (rows.length === 0) { toast({ title: "No valid rows found in CSV", variant: "destructive" }); return; }
      importMutation.mutate(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  function SortIcon({ field }: { field: keyof Holding }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  }

  const editHolding = holdings.find(h => h.id === editId);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Holdings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {nonCash.length} position{nonCash.length !== 1 ? "s" : ""} · Cost ${(totalCost / 1000).toFixed(1)}k
            {totalCashValue > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
                · <Banknote className="w-3 h-3" /> ${(totalCashValue / 1000).toFixed(1)}k cash
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
          <Button
            data-testid="btn-import-csv"
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Import CSV
          </Button>
          <Button
            data-testid="btn-add-cash"
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2.5 border-green-500/40 text-green-600 dark:text-green-400 hover:bg-green-500/10"
            onClick={() => setShowAddCash(true)}
          >
            <Banknote className="w-3 h-3 mr-1.5" />
            Add Cash
          </Button>
          <Button
            data-testid="btn-add-holding"
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            Add
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {[
                    { key: "ticker" as keyof Holding, label: "Ticker" },
                    { key: "sector" as keyof Holding, label: "Sector" },
                    { key: "shares" as keyof Holding, label: "Shares / Amount" },
                    { key: "avgCost" as keyof Holding, label: "Avg Cost" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-4 py-2.5 text-left text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort(key)}
                    >
                      {label} <SortIcon field={key} />
                    </th>
                  ))}
                  <th
                    className="px-4 py-2.5 text-left text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort("purchaseDate" as keyof Holding)}
                  >
                    Purchased <SortIcon field={"purchaseDate" as keyof Holding} />
                  </th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Total Cost</th>
                  <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Notes</th>
                  <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : sortedHoldings.map(h => {
                      const isCash = h.ticker === "CASH";
                      return (
                        <tr key={h.id} data-testid={`holding-row-${h.id}`} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                          <td className="px-4 py-3">
                            {isCash ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded bg-green-500/15 flex items-center justify-center shrink-0">
                                  <Banknote className="w-3.5 h-3.5 text-green-500" />
                                </div>
                                <div>
                                  <div className="font-semibold text-green-600 dark:text-green-400">CASH</div>
                                  <div className="text-muted-foreground truncate max-w-[130px]">{h.name}</div>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-foreground">{h.ticker}</div>
                                <div className="text-muted-foreground truncate max-w-[150px]">{h.name}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isCash ? (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/15 text-green-600 dark:text-green-400">Cash</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-accent text-foreground">{h.sector}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono-nums">
                            {isCash ? `$${fmt(h.shares, 0)}` : fmt(h.shares, 0)}
                          </td>
                          <td className="px-4 py-3 font-mono-nums text-muted-foreground">
                            {isCash ? <span className="text-muted-foreground/60">-</span> : `$${fmt(h.avgCost)}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {h.purchaseDate
                              ? new Date(h.purchaseDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : <span className="text-muted-foreground/40">-</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono-nums">
                            {isCash ? `$${fmt(h.shares, 0)}` : `$${fmt(h.avgCost * h.shares)}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{h.notes || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                data-testid={`btn-edit-${h.id}`}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditId(h.id)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                data-testid={`btn-delete-${h.id}`}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(h.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CSV hint */}
      <p className="text-xs text-muted-foreground">
        CSV format: <span className="font-mono-nums text-foreground">ticker, name, shares, avg_cost, sector, notes, purchase_date</span>
        <span className="ml-1.5 text-muted-foreground/60">(purchase_date: YYYY-MM-DD, optional)</span>
      </p>

      {/* Add Holding Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent data-testid="dialog-add-holding">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Holding</DialogTitle>
          </DialogHeader>
          <HoldingForm
            onSubmit={(data) => addMutation.mutate(data)}
            onCancel={() => setShowAdd(false)}
            loading={addMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Add Cash Dialog */}
      <Dialog open={showAddCash} onOpenChange={setShowAddCash}>
        <DialogContent data-testid="dialog-add-cash">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Cash Position</DialogTitle>
          </DialogHeader>
          <HoldingForm
            isCashPreset
            onSubmit={(data) => addMutation.mutate(data)}
            onCancel={() => setShowAddCash(false)}
            loading={addMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={() => setEditId(null)}>
        <DialogContent data-testid="dialog-edit-holding">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit {editHolding?.ticker}</DialogTitle>
          </DialogHeader>
          {editHolding && (
            <HoldingForm
              initial={editHolding}
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
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Holding?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{holdings.find(h => h.id === deleteId)?.ticker}</strong> from your portfolio?
          </p>
          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              data-testid="btn-confirm-delete"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteId!)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

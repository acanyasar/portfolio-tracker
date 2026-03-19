import { useQuery } from "@tanstack/react-query";
import { cn, fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface EnrichedHolding {
  id: number; ticker: string; pnlPercent: number; pnl: number; value: number; isCash?: boolean; currentPrice: number;
}
interface PortfolioSummary { holdings: EnrichedHolding[]; }

export default function PerformanceRankingWidget() {
  const { data, isLoading } = useQuery<PortfolioSummary>({ queryKey: ["/api/portfolio/summary"] });

  const priced = (data?.holdings ?? []).filter(h => !h.isCash && h.currentPrice > 0);
  const sorted = [...priced].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.filter(h => h.pnlPercent < 0).slice(-2);
  const maxAbsPct = Math.max(...priced.map(h => Math.abs(h.pnlPercent)), 1);

  const Row = ({ h }: { h: EnrichedHolding }) => (
    <div key={h.id} className="flex items-center gap-2">
      <span className="text-xs font-semibold text-foreground w-12 shrink-0">{h.ticker}</span>
      <div className="flex-1 h-4 bg-accent rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", h.pnlPercent >= 0 ? "bg-emerald-500/70" : "bg-red-500/70")}
          style={{ width: `${(Math.abs(h.pnlPercent) / maxAbsPct) * 100}%` }}
        />
      </div>
      <span className={cn("text-xs font-mono-nums font-semibold w-14 text-right shrink-0", h.pnlPercent >= 0 ? "text-up" : "text-down")}>
        {h.pnlPercent >= 0 ? "+" : ""}{fmt(h.pnlPercent)}%
      </span>
    </div>
  );

  return (
    <WidgetCard title="Performance Ranking" isLoading={isLoading} skeletonRows={5}>
      {gainers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No price data yet</p>
      ) : (
        <div className="space-y-2">
          {gainers.map(h => <Row key={h.id} h={h} />)}
          {losers.length > 0 && gainers.some(g => g.pnlPercent >= 0) && losers.some(l => !gainers.find(g => g.id === l.id)) && (
            <>
              <div className="border-t border-border/50 pt-1 mt-1" />
              {losers.filter(l => !gainers.find(g => g.id === l.id)).map(h => <Row key={h.id} h={h} />)}
            </>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

import { useQuery } from "@tanstack/react-query";
import { cn, fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface EnrichedHolding {
  ticker: string; sector: string; value: number; isCash?: boolean; currentPrice: number;
}
interface PortfolioSummary {
  holdings: EnrichedHolding[]; totalValue: number;
}

const SECTOR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
];
const SECTOR_TEXT = [
  "text-blue-500", "text-violet-500", "text-emerald-500", "text-amber-500",
  "text-rose-500", "text-cyan-500", "text-orange-500", "text-pink-500",
];

export default function SectorAllocationWidget() {
  const { data, isLoading } = useQuery<PortfolioSummary>({ queryKey: ["/api/portfolio/summary"] });

  const investedHoldings = data?.holdings.filter(h => !h.isCash && h.currentPrice > 0) ?? [];
  const investedValue = investedHoldings.reduce((s, h) => s + h.value, 0);

  // Group by sector
  const sectorMap: Record<string, number> = {};
  for (const h of investedHoldings) {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.value;
  }
  const sectors = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: investedValue > 0 ? (value / investedValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // Top 4 + "Other"
  const top = sectors.slice(0, 4);
  const rest = sectors.slice(4);
  const otherValue = rest.reduce((s, x) => s + x.value, 0);
  const otherPct = rest.reduce((s, x) => s + x.pct, 0);
  const display = rest.length > 0
    ? [...top, { name: "Other", value: otherValue, pct: otherPct }]
    : top;

  const maxPct = display[0]?.pct ?? 0;
  const topSector = display[0];
  const hasConcentration = topSector && topSector.pct > 50;

  return (
    <WidgetCard title="Sector Allocation" isLoading={isLoading} skeletonRows={4}>
      {display.length === 0 ? (
        <p className="text-xs text-muted-foreground">No holdings data</p>
      ) : (
        <div className="space-y-2.5">
          {display.map((s, i) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", SECTOR_COLORS[i % SECTOR_COLORS.length])} />
                  <span className="text-foreground truncate">{s.name}</span>
                </div>
                <span className={cn("font-mono-nums font-semibold ml-2 shrink-0", SECTOR_TEXT[i % SECTOR_TEXT.length])}>
                  {fmt(s.pct, 1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                <div
                  className={cn("h-full rounded-full", SECTOR_COLORS[i % SECTOR_COLORS.length])}
                  style={{ width: `${maxPct > 0 ? (s.pct / maxPct) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          {hasConcentration && (
            <p className="text-[10px] text-amber-500 font-medium pt-1">
              ⚠ {topSector.name} exceeds 50% of portfolio
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

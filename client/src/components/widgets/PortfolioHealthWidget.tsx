import { useQuery } from "@tanstack/react-query";
import { cn, fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface EnrichedHolding {
  ticker: string; sector: string; value: number; isCash?: boolean; currentPrice: number;
}
interface PortfolioSummary {
  holdings: EnrichedHolding[]; totalValue: number;
}

interface Alert { message: string; severity: "danger" | "warning" | "info"; }

const severityClass = {
  danger: "bg-red-500/15 text-red-500 border-red-500/20",
  warning: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  info: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

export default function PortfolioHealthWidget() {
  const { data, isLoading } = useQuery<PortfolioSummary>({ queryKey: ["/api/portfolio/summary"] });

  const investedHoldings = data?.holdings.filter(h => !h.isCash && h.currentPrice > 0) ?? [];
  const investedValue = investedHoldings.reduce((s, h) => s + h.value, 0);

  const sectorMap: Record<string, number> = {};
  for (const h of investedHoldings) sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.value;
  const sectorCount = Object.keys(sectorMap).length;
  const avgWeight = investedHoldings.length > 0 ? 100 / investedHoldings.length : 0;

  const alerts: Alert[] = [];

  if (data && investedValue > 0) {
    // Concentration check per position
    const topHolding = [...investedHoldings].sort((a, b) => b.value - a.value)[0];
    if (topHolding) {
      const weight = (topHolding.value / investedValue) * 100;
      if (weight > 40) alerts.push({ message: `${topHolding.ticker} is ${fmt(weight, 0)}% of portfolio`, severity: "danger" });
      else if (weight > 25) alerts.push({ message: `${topHolding.ticker} is ${fmt(weight, 0)}% of portfolio`, severity: "warning" });
    }

    // Sector concentration
    const topSector = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0];
    if (topSector && (topSector[1] / investedValue) * 100 > 50) {
      alerts.push({ message: `${topSector[0]} sector is ${fmt((topSector[1] / investedValue) * 100, 0)}% of portfolio`, severity: "warning" });
    }

    // Diversification
    if (investedHoldings.length < 5) {
      alerts.push({ message: `Only ${investedHoldings.length} positions — consider diversifying`, severity: "info" });
    }

    // Sector count
    if (sectorCount < 3) {
      alerts.push({ message: `Positions span only ${sectorCount} sector${sectorCount !== 1 ? "s" : ""}`, severity: "info" });
    }
  }



  return (
    <WidgetCard title="Portfolio Health" isLoading={isLoading} skeletonRows={3}>
      {alerts.length === 0 && investedHoldings.length > 0 ? (
        <p className="text-xs text-up font-medium">✓ No concentration issues detected</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No holdings data</p>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div key={i} className={cn("text-xs px-2.5 py-1.5 rounded-md border font-medium", severityClass[a.severity])}>
              {a.message}
            </div>
          ))}
        </div>
      )}
      {investedHoldings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs font-semibold text-foreground">{investedHoldings.length}</div>
            <div className="text-[10px] text-muted-foreground">Positions</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">{sectorCount}</div>
            <div className="text-[10px] text-muted-foreground">Sectors</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">{fmt(avgWeight, 1)}%</div>
            <div className="text-[10px] text-muted-foreground">Avg weight</div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

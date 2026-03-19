import { useQuery } from "@tanstack/react-query";

export interface EnrichedHolding {
  id: number;
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  sector: string;
  notes: string | null;
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

export interface PortfolioSummary {
  holdings: EnrichedHolding[];
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashValue?: number;
}

export function useEnrichedHoldings() {
  return useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

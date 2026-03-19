import { useQuery } from "@tanstack/react-query";
import { fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface DividendHolding {
  ticker: string; nextPaymentDate: string | null; nextPayment: number; annualIncome: number;
}
interface DividendSummary { holdings: DividendHolding[]; }

export default function UpcomingEventsWidget() {
  const { data, isLoading } = useQuery<DividendSummary>({
    queryKey: ["/api/portfolio/dividends"],
    staleTime: 5 * 60_000,
  });

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcoming = (data?.holdings ?? [])
    .filter(h => h.nextPaymentDate && h.annualIncome > 0)
    .filter(h => {
      const d = new Date(h.nextPaymentDate! + "T12:00:00Z");
      return d >= now && d <= in30;
    })
    .sort((a, b) => (a.nextPaymentDate ?? "").localeCompare(b.nextPaymentDate ?? ""))
    .slice(0, 6);

  const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const daysUntil = (iso: string) => Math.ceil((new Date(iso + "T12:00:00Z").getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <WidgetCard title="Upcoming Dividends" isLoading={isLoading} skeletonRows={3}>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">No dividend payments in the next 30 days</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map(h => {
            const days = daysUntil(h.nextPaymentDate!);
            return (
              <div key={h.ticker} className="flex items-center gap-2.5">
                <div className="shrink-0 text-center w-10">
                  <div className="text-[10px] font-semibold bg-primary/15 text-primary rounded px-1 py-0.5">
                    {fmtDate(h.nextPaymentDate!)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">{h.ticker}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {days === 0 ? "Today" : `in ${days}d`}
                  </div>
                </div>
                <div className="text-xs font-semibold text-up font-mono-nums shrink-0">
                  {h.nextPayment > 0 ? `$${fmt(h.nextPayment)}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

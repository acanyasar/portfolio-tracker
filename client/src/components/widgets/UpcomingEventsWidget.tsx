import { useQuery } from "@tanstack/react-query";
import { cn, fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface PortfolioEvent {
  date: string;
  ticker: string;
  companyName: string;
  type: "earnings" | "dividend" | "ex_dividend";
  detail: string;
  amount?: number;
  epsEstimate?: number;
}

const MAX_VISIBLE = 6;

const badgeClass: Record<PortfolioEvent["type"], string> = {
  earnings:    "bg-blue-500/15 text-blue-500",
  dividend:    "bg-green-500/15 text-green-500",
  ex_dividend: "bg-amber-500/15 text-amber-500",
};

const typeLabel: Record<PortfolioEvent["type"], string> = {
  earnings:    "Earnings",
  dividend:    "Dividend",
  ex_dividend: "Ex-div",
};

const typeLabelClass: Record<PortfolioEvent["type"], string> = {
  earnings:    "text-blue-500",
  dividend:    "text-green-500",
  ex_dividend: "text-amber-500",
};

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string) {
  const now = new Date();
  const target = new Date(iso + "T12:00:00Z");
  return Math.ceil((target.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
}

function relativeTime(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

export default function UpcomingEventsWidget() {
  const { data, isLoading } = useQuery<{ events: PortfolioEvent[] }>({
    queryKey: ["/api/portfolio/events"],
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: true,
  });

  const events = data?.events ?? [];
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  return (
    <WidgetCard title="Upcoming Events" isLoading={isLoading} skeletonRows={6}>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No upcoming events in the next 30 days
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((ev, i) => {
            const days = daysUntil(ev.date);
            return (
              <div key={`${ev.ticker}-${ev.type}-${i}`} className="flex items-center gap-2.5">
                {/* Date badge */}
                <div className="shrink-0 text-center w-10">
                  <div className={cn("text-[10px] font-semibold rounded px-1 py-0.5", badgeClass[ev.type])}>
                    {fmtDate(ev.date)}
                  </div>
                </div>

                {/* Ticker + relative time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{ev.ticker}</span>
                    <span className={cn("text-[10px] font-medium", typeLabelClass[ev.type])}>
                      {typeLabel[ev.type]}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{relativeTime(days)}</div>
                </div>

                {/* Right-side amount / EPS */}
                <div className="text-xs font-semibold font-mono-nums shrink-0">
                  {ev.type === "dividend" && ev.amount != null && (
                    <span className="text-up">${fmt(ev.amount)}</span>
                  )}
                  {ev.type === "earnings" && ev.epsEstimate != null && (
                    <span className="text-muted-foreground">Est ${ev.epsEstimate.toFixed(2)}</span>
                  )}
                </div>
              </div>
            );
          })}

          {overflow > 0 && (
            <p className="text-[10px] text-muted-foreground pt-1">
              + {overflow} more event{overflow !== 1 ? "s" : ""} this month
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

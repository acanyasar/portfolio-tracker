import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, ArrowLeftRight, Eye } from "lucide-react";
import { cn, fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";
import type { Transaction } from "@shared/schema";

const typeColors: Record<string, string> = {
  BUY: "bg-green-500/15 text-green-600 dark:text-green-400",
  SELL: "bg-red-500/15 text-red-400",
  SELL_ALL: "bg-red-500/15 text-red-400",
};

export default function QuickActionsWidget() {
  const [, navigate] = useLocation();
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const recent = (transactions ?? []).slice(0, 4);

  return (
    <WidgetCard title="Quick Actions" isLoading={isLoading} skeletonRows={3}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "+ Holding", icon: Plus, href: "/holdings" },
            { label: "+ Trade", icon: ArrowLeftRight, href: "/transactions" },
            { label: "Set Alert", icon: Eye, href: "/watchlist" },
          ].map(({ label, icon: Icon, href }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-accent transition-colors text-foreground"
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <>
            <div className="border-t border-border/50" />
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Recent Trades</p>
              {recent.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0", typeColors[tx.type] ?? "bg-accent")}>
                      {tx.type === "SELL_ALL" ? "SELL" : tx.type}
                    </span>
                    <span className="font-semibold text-foreground">{tx.ticker}</span>
                    <span className="text-muted-foreground">×{fmt(tx.shares, 0)}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {new Date(tx.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </WidgetCard>
  );
}

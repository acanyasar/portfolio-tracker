import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { useWidgetPreferences } from "@/hooks/useWidgetPreferences";
import type { WidgetId } from "@/hooks/useWidgetPreferences";

const WIDGET_META: Array<{ id: WidgetId; name: string; description: string }> = [
  { id: "sectorAllocation",   name: "Sector Allocation",   description: "Portfolio breakdown by sector with concentration warnings" },
  { id: "performanceRanking", name: "Performance Ranking", description: "Holdings ranked by P&L percentage" },
  { id: "portfolioHealth",    name: "Portfolio Health",    description: "Concentration and diversification alerts" },
  { id: "quickActions",       name: "Quick Actions",       description: "Shortcuts and recent trade history" },
  { id: "dividendIncome",     name: "Dividend Income",     description: "12-month dividend income chart" },
  { id: "upcomingEvents",     name: "Upcoming Dividends",  description: "Dividend payments in the next 30 days" },
];

export default function WidgetCustomizeDialog() {
  const { prefs, toggleWidget } = useWidgetPreferences();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Customize dashboard"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Customize Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {WIDGET_META.map(({ id, name, description }) => (
            <div key={id} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Label htmlFor={`widget-${id}`} className="text-sm font-medium cursor-pointer">{name}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
              <Switch
                id={`widget-${id}`}
                checked={prefs[id]}
                onCheckedChange={() => toggleWidget(id)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

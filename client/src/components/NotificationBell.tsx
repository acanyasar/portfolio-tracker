import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@shared/schema";

function relativeTime(date: Date | string) {
  const d = new Date(date);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationItem({ n }: { n: Notification }) {
  const isLow = n.type === "ALERT_LOW";
  return (
    <div className="px-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            isLow ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-500"
          )}>
            {n.ticker}
          </span>
          <span className="text-xs text-muted-foreground">
            {isLow ? "hit low target" : "hit high target"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{relativeTime(n.createdAt)}</span>
      </div>
      <p className="text-xs text-foreground mt-1">
        Price <span className="font-mono-nums font-medium">${n.price.toFixed(2)}</span>
        {" "}{isLow ? "≤" : "≥"} threshold <span className="font-mono-nums font-medium">${n.threshold.toFixed(2)}</span>
      </p>
    </div>
  );
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold">Alerts</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => markAllRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">No unread alerts</p>
          ) : (
            notifications.map(n => <NotificationItem key={n.id} n={n} />)
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

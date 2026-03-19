import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  LayoutDashboard, LineChart, ListOrdered, Eye, Sun, Moon, Coins, ArrowLeftRight, LogOut, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/holdings", label: "Holdings", icon: ListOrdered },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/dividends", label: "Dividends", icon: Coins },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
];

interface Props {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function Sidebar({ theme, onToggleTheme }: Props) {
  const [location] = useHashLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="w-56 flex flex-col border-r border-border bg-card shrink-0">
      {/* Logo + Bell */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg
                aria-label="Portfolio Tracker Logo"
                viewBox="0 0 28 28"
                fill="none"
                className="w-5 h-5"
              >
                <rect x="3" y="14" width="5" height="11" rx="1" fill="hsl(var(--primary))" />
                <rect x="11" y="9" width="5" height="16" rx="1" fill="hsl(var(--primary))" opacity="0.75" />
                <rect x="19" y="4" width="5" height="21" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
                <path d="M3 18 L8.5 12 L14 15 L19.5 8 L25 5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-tight">Portfolio</div>
              <div className="text-xs text-muted-foreground leading-tight">Tracker</div>
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border space-y-2">
        {/* User info + logout */}
        {user && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-accent/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground truncate">{user.username}</span>
            </div>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          data-testid="btn-theme-toggle"
          onClick={onToggleTheme}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </aside>
  );
}

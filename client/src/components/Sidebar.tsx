import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  LayoutDashboard, LineChart, ListOrdered, Eye, Sun, Moon, Coins,
  ArrowLeftRight, LogOut, User, ChevronLeft, ChevronRight, X,
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
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ theme, onToggleTheme, isOpen, onClose, collapsed, onToggleCollapse }: Props) {
  const [location] = useHashLocation();
  const { user, logout } = useAuth();

  return (
    <aside className={cn(
      "flex flex-col border-r border-border bg-card shrink-0",
      // Mobile: fixed overlay, slides in/out
      "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out",
      isOpen ? "translate-x-0" : "-translate-x-full",
      // Desktop: static in-flow, no translation, width based on collapsed
      "lg:static lg:inset-auto lg:z-auto lg:translate-x-0",
      collapsed ? "lg:w-14" : "lg:w-56",
    )}>
      {/* Header: Logo + Bell + Buttons */}
      <div className={cn("py-4 border-b border-border", collapsed ? "lg:px-2" : "px-4")}>
        <div className={cn("flex items-center", collapsed ? "lg:justify-center" : "justify-between")}>
          {/* Logo */}
          <div className={cn("flex items-center gap-2.5 min-w-0", collapsed && "lg:hidden")}>
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <svg aria-label="Portfolio Tracker Logo" viewBox="0 0 28 28" fill="none" className="w-5 h-5">
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

          {/* Collapsed desktop: just the logo icon */}
          <div className={cn("hidden shrink-0", collapsed && "lg:flex items-center justify-center")}>
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg aria-label="Portfolio Tracker Logo" viewBox="0 0 28 28" fill="none" className="w-5 h-5">
                <rect x="3" y="14" width="5" height="11" rx="1" fill="hsl(var(--primary))" />
                <rect x="11" y="9" width="5" height="16" rx="1" fill="hsl(var(--primary))" opacity="0.75" />
                <rect x="19" y="4" width="5" height="21" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
                <path d="M3 18 L8.5 12 L14 15 L19.5 8 L25 5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Right side controls */}
          <div className={cn("flex items-center gap-1", collapsed && "lg:hidden")}>
            <NotificationBell />
            {/* Desktop collapse button */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Expand button when collapsed (desktop only) */}
          <button
            onClick={onToggleCollapse}
            className={cn("hidden transition-colors text-muted-foreground hover:text-foreground", collapsed && "lg:flex items-center justify-center mt-2")}
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Notification bell row when collapsed */}
        {collapsed && (
          <div className="hidden lg:flex justify-center mt-3">
            <NotificationBell />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase()}`}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>{label}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-border space-y-2", collapsed ? "lg:px-2 lg:py-3 px-3 py-3" : "px-3 py-3")}>
        {user && (
          <div className={cn(
            "flex items-center rounded-md bg-accent/50",
            collapsed ? "lg:justify-center lg:p-1.5 px-3 py-1.5 justify-between" : "justify-between px-3 py-1.5"
          )}>
            <div className={cn("flex items-center gap-1.5 min-w-0", collapsed && "lg:hidden")}>
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground truncate">{user.username}</span>
            </div>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={cn(
                "p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0",
                !collapsed && "ml-1"
              )}
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          data-testid="btn-theme-toggle"
          onClick={onToggleTheme}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            collapsed && "lg:justify-center lg:px-2"
          )}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 shrink-0" />}
          <span className={cn(collapsed && "lg:hidden")}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>
      </div>
    </aside>
  );
}

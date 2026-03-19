import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmt } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

interface MonthData { month: string; amount: number; projected: boolean; }
interface DividendSummary { months: MonthData[]; totalAnnual: number; avgMonthly: number; }

export default function DividendIncomeWidget() {
  const { data, isLoading } = useQuery<DividendSummary>({
    queryKey: ["/api/portfolio/dividend-summary"],
    staleTime: 5 * 60_000,
  });

  const now = new Date();
  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "short" });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-lg">
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-primary font-mono font-semibold">${fmt(payload[0].value)}</div>
      </div>
    );
  };

  return (
    <WidgetCard title="Dividend Income" isLoading={isLoading} skeletonRows={4}>
      {!data || data.totalAnnual === 0 ? (
        <p className="text-xs text-muted-foreground">No dividend-paying holdings</p>
      ) : (
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={data.months} margin={{ top: 4, right: 0, left: -32, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                {data.months.map((m, i) => (
                  <Cell
                    key={i}
                    fill={m.month === currentMonthLabel
                      ? "hsl(145 63% 42%)"
                      : m.projected
                        ? "hsl(210 100% 56% / 0.45)"
                        : "hsl(210 100% 56%)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-accent/50 rounded-md px-2.5 py-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Annual</div>
              <div className="font-semibold font-mono-nums text-up mt-0.5">${fmt(data.totalAnnual)}</div>
            </div>
            <div className="bg-accent/50 rounded-md px-2.5 py-2">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Monthly avg</div>
              <div className="font-semibold font-mono-nums text-foreground mt-0.5">${fmt(data.avgMonthly)}</div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Faded bars = projected · darker = actual</p>
        </div>
      )}
    </WidgetCard>
  );
}

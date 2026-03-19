import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  className?: string;
}

export default function WidgetCard({ title, children, isLoading, skeletonRows = 4, className }: Props) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

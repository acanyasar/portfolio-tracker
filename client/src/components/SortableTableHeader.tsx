import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnDef {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  className?: string;
}

interface Props {
  columns: ColumnDef[];
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}

export default function SortableTableHeader({ columns, sortField, sortDir, onSort }: Props) {
  return (
    <thead>
      <tr className="border-b border-border">
        {columns.map(col => {
          const isActive = sortField === col.key;
          const sortable = col.sortable !== false;
          const SortArrow = isActive
            ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
            : null;
          return (
            <th
              key={col.key}
              onClick={sortable ? () => onSort(col.key) : undefined}
              className={cn(
                "px-4 py-2.5 text-muted-foreground font-medium select-none",
                col.align === "right" ? "text-right" : "text-left",
                sortable && "cursor-pointer hover:text-foreground transition-colors",
                col.className,
              )}
            >
              <span className="inline-flex items-center gap-1">
                {col.align === "right" && SortArrow}
                {col.label}
                {col.align !== "right" && SortArrow}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

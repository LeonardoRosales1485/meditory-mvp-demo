import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MobileListViewMode } from "@/lib/use-mobile-list-view";

interface Props {
  value: MobileListViewMode;
  onChange: (value: MobileListViewMode) => void;
  className?: string;
}

export function MobileViewToggle({ value, onChange, className }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-md border bg-background p-1", className)}>
      <Button
        type="button"
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChange("cards")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </Button>
      <Button
        type="button"
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChange("table")}
      >
        <Table2 className="h-3.5 w-3.5" />
        Tabla
      </Button>
    </div>
  );
}

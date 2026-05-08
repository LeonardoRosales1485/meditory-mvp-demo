import { Badge } from "@/components/ui/badge";

const map: Record<string, string> = {
  solicitado: "bg-muted text-foreground",
  autorizado: "bg-primary-soft text-primary",
  despachado: "bg-accent text-accent-foreground",
  recibir: "bg-blue-100 text-blue-700",
  recibido: "bg-success/15 text-success",
  aceptado: "bg-emerald-200 text-emerald-800",
  rechazado: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`capitalize ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

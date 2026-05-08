import { Badge } from "@/components/ui/badge";
import { daysUntil, expiryStatus } from "@/lib/domain-types";

export function ExpiryBadge({ expiry }: { expiry: string }) {
  const status = expiryStatus(expiry);
  const days = daysUntil(expiry);
  if (status === "vencido") {
    return (
      <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
        Vencido hace {Math.abs(days)} d
      </Badge>
    );
  }
  if (status === "critico") {
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning">
        Vence en {days} d
      </Badge>
    );
  }
  if (status === "proximo") {
    return <Badge variant="secondary">{days} d</Badge>;
  }
  return <Badge variant="outline">{days} d</Badge>;
}
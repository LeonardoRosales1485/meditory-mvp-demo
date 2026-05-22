import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { formatDate, medName, warehouseName } from "@/lib/domain-types";
import type { Movement, Warehouse } from "@/lib/domain-types";

interface Props { movements: Movement[]; warehouses: Warehouse[] }

const typeColor: Record<string, string> = {
  ingreso: "bg-success/10 text-success",
  egreso: "bg-destructive/10 text-destructive",
  transferencia: "bg-chart-1/10 text-chart-1",
  venta: "bg-chart-2/10 text-chart-2",
  dispensacion: "bg-chart-3/10 text-chart-3",
  ajuste: "bg-warning/10 text-warning",
};

export function DashboardMovementsTab({ movements, warehouses }: Props) {
  const { mobileView, setMobileView } = useMobileListView();

  const sorted = [...movements].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sorted.length} movimientos</p>
        <MobileViewToggle mobileView={mobileView} onToggle={setMobileView} />
      </div>

      {mobileView ? (
        <div className="space-y-2">
          {sorted.slice(0, 50).map((m) => (
            <Card key={m.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{medName(m.medicationId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {warehouseName(m.warehouseId)} · {m.user}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`capitalize ${typeColor[m.type] ?? ""}`}>
                      {m.type}
                    </Badge>
                    <p className="mt-1 text-sm font-semibold">{m.quantity} u</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(m.date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos.</p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 100).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${typeColor[m.type] ?? ""}`}>
                      {m.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{medName(m.medicationId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{warehouseName(m.warehouseId)}</TableCell>
                  <TableCell className="text-xs">{m.user}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(m.date)}</TableCell>
                  <TableCell className="text-right font-semibold">{m.quantity}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Sin movimientos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

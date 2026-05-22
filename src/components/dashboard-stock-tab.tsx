import { Package, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { expiryStatus, formatDate, medName, warehouseName } from "@/lib/domain-types";
import type { Batch, Warehouse } from "@/lib/domain-types";

interface Props { batches: Batch[]; warehouses: Warehouse[] }

const expiryColor: Record<string, string> = {
  vencido: "bg-destructive/10 text-destructive",
  critico: "bg-warning/10 text-warning",
  proximo: "bg-chart-2/10 text-chart-2",
  ok: "text-muted-foreground",
};

export function DashboardStockTab({ batches, warehouses }: Props) {
  const { mobileView, setMobileView } = useMobileListView();

  const sorted = [...batches].sort(
    (a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime(),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sorted.length} lotes</p>
        <MobileViewToggle mobileView={mobileView} onToggle={setMobileView} />
      </div>

      {mobileView ? (
        <div className="space-y-2">
          {sorted.map((b) => {
            const status = expiryStatus(b.expiry);
            return (
              <Card key={b.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{medName(b.medicationId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {warehouseName(b.warehouseId)} · Lote {b.lot}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{b.quantity} u</p>
                      <Badge variant="outline" className={`mt-1 text-[10px] ${expiryColor[status] ?? ""}`}>
                        {formatDate(b.expiry)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin stock disponible.</p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicamento</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((b) => {
                const status = expiryStatus(b.expiry);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{medName(b.medicationId)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{warehouseName(b.warehouseId)}</TableCell>
                    <TableCell className="text-xs">{b.lot}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${expiryColor[status] ?? ""}`}>
                        {status === "ok" ? formatDate(b.expiry) : status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{b.quantity}</TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Sin stock disponible.
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

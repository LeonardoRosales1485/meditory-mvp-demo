import { ArrowLeftRight, PackageCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { formatDate, medName, warehouseName } from "@/lib/domain-types";
import type { TransferRequest, Warehouse } from "@/lib/domain-types";

interface Props { transfers: TransferRequest[]; warehouses: Warehouse[] }

const statusColor: Record<string, string> = {
  solicitado: "bg-muted text-foreground",
  autorizado: "bg-primary-soft text-primary",
  despachado: "bg-accent text-accent-foreground",
  recibir: "bg-blue-100 text-blue-700",
  recibido: "bg-success/15 text-success",
  aceptado: "bg-emerald-200 text-emerald-800",
  rechazado: "bg-destructive/10 text-destructive",
};

export function DashboardTransfersTab({ transfers, warehouses }: Props) {
  const { mobileView, setMobileView } = useMobileListView();

  const sorted = [...transfers].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sorted.length} transferencias</p>
        <MobileViewToggle mobileView={mobileView} onToggle={setMobileView} />
      </div>

      {mobileView ? (
        <div className="space-y-2">
          {sorted.slice(0, 50).map((t) => (
            <Card key={t.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{medName(t.medicationId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {warehouseName(t.fromWarehouseId)} → {warehouseName(t.toWarehouseId)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`capitalize ${statusColor[t.status] ?? ""}`}>
                      {t.status}
                    </Badge>
                    <p className="mt-1 text-sm font-semibold">{t.quantity} u</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin transferencias.</p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Solicitó</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 100).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusColor[t.status] ?? ""}`}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{medName(t.medicationId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{warehouseName(t.fromWarehouseId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{warehouseName(t.toWarehouseId)}</TableCell>
                  <TableCell className="text-xs">{t.requestedBy}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(t.date)}</TableCell>
                  <TableCell className="text-right font-semibold">{t.quantity}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Sin transferencias.
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

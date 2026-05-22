import { ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { formatDate, medName, warehouseName } from "@/lib/domain-types";
import type { MedicationOrder, Warehouse } from "@/lib/domain-types";

interface Props { orders: MedicationOrder[]; warehouses: Warehouse[] }

const statusColor: Record<string, string> = {
  pendiente: "bg-muted text-foreground",
  aprobado: "bg-primary-soft text-primary",
  despachado: "bg-accent text-accent-foreground",
  recibir: "bg-blue-100 text-blue-700",
  recibido: "bg-success/15 text-success",
  administrado: "bg-emerald-200 text-emerald-800",
  rechazado: "bg-destructive/10 text-destructive",
};

export function DashboardOrdersTab({ orders, warehouses }: Props) {
  const { mobileView, setMobileView } = useMobileListView();

  const sorted = [...orders].sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sorted.length} pedidos</p>
        <MobileViewToggle mobileView={mobileView} onToggle={setMobileView} />
      </div>

      {mobileView ? (
        <div className="space-y-2">
          {sorted.slice(0, 50).map((o) => (
            <Card key={o.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{medName(o.medicationId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {warehouseName(o.warehouseId)} · Dr. {o.doctor}
                    </p>
                    {o.patient && (
                      <p className="text-xs text-muted-foreground">Paciente: {o.patient}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`capitalize ${statusColor[o.status] ?? ""}`}>
                      {o.status}
                    </Badge>
                    <p className="mt-1 text-sm font-semibold">{o.quantity} u</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(o.requestedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin pedidos.</p>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 100).map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${statusColor[o.status] ?? ""}`}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{medName(o.medicationId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{warehouseName(o.warehouseId)}</TableCell>
                  <TableCell className="text-xs">{o.doctor}</TableCell>
                  <TableCell className="text-xs">{o.patient ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(o.requestedAt)}</TableCell>
                  <TableCell className="text-right font-semibold">{o.quantity}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Sin pedidos.
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

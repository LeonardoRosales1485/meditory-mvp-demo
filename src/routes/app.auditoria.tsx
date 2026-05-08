import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/domain-types";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/auditoria")({
  beforeLoad: requireAdmin,
  component: AuditPage,
});

function AuditPage() {
  const audit = useStore((s) => s.audit);
  const medications = useStore((s) => s.medications);
  const users = useStore((s) => s.users);
  const warehouses = useStore((s) => s.warehouses);
  const orders = useStore((s) => s.orders);
  const transfers = useStore((s) => s.transfers);
  const [q, setQ] = useState("");

  const isUuidLike = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

  const actionLabel = (action: string): string => {
    const normalized = action.toLowerCase();
    if (normalized.includes("alta de medicamento")) return "Alta de medicamento";
    if (normalized.includes("editó medicamento")) return "Edición de medicamento";
    if (normalized.includes("eliminó medicamento")) return "Baja de medicamento";
    if (normalized.includes("ingreso de mercadería")) return "Ingreso de mercadería";
    if (normalized.includes("ajuste de stock")) return "Ajuste de stock";
    if (normalized.includes("transferencia solicitada") || normalized.includes("solicitó transferencia")) return "Transferencia solicitada";
    if (normalized.includes("transferencia autorizado") || normalized.includes("transferencia -> autorizado")) return "Transferencia autorizada";
    if (normalized.includes("transferencia despachado") || normalized.includes("transferencia -> despachado")) return "Transferencia despachada";
    if (normalized.includes("transferencia recibir") || normalized.includes("transferencia -> recibir")) return "Transferencia en recibir";
    if (normalized.includes("transferencia recibido") || normalized.includes("transferencia -> recibido")) return "Transferencia recibida";
    if (normalized.includes("transferencia aceptado") || normalized.includes("transferencia -> aceptado")) return "Transferencia aceptada";
    if (normalized.includes("transferencia rechazada")) return "Transferencia rechazada";
    if (normalized.includes("venta registrada")) return "Venta registrada";
    if (normalized.includes("dispensación interna")) return "Dispensación interna";
    if (normalized.includes("pedido de medicación")) return "Pedido de medicación";
    if (normalized.includes("pedido aprobar")) return "Pedido aprobado";
    if (normalized.includes("pedido despachar")) return "Pedido dispensado";
    if (normalized.includes("pedido marcar_recibir")) return "Pedido en recibir";
    if (normalized.includes("pedido confirmar_recepcion")) return "Pedido recibido";
    if (normalized.includes("pedido administrar")) return "Pedido administrado";
    if (normalized.includes("pedido solicitar_devolucion")) return "Devolución solicitada";
    if (normalized.includes("pedido aprobar_devolucion")) return "Devolución aprobada";
    if (normalized.includes("pedido rechazar_devolucion")) return "Devolución rechazada";
    if (normalized.includes("pedido rechazar")) return "Pedido rechazado";
    if (normalized.includes("alta de usuario")) return "Alta de usuario";
    if (normalized.includes("editó usuario")) return "Edición de usuario";
    if (normalized.includes("baja de usuario")) return "Baja de usuario";
    if (normalized.includes("alta de depósito")) return "Alta de depósito";
    if (normalized.includes("editó depósito")) return "Edición de depósito";
    if (normalized.includes("baja de depósito")) return "Baja de depósito";
    if (normalized.includes("alta de paciente")) return "Alta de paciente";
    if (normalized.includes("editó paciente")) return "Edición de paciente";
    if (normalized.includes("baja de paciente")) return "Baja de paciente";
    return action;
  };

  const detailLabel = (action: string, entity: string): string => {
    const normalized = action.toLowerCase();
    const text = entity.trim();

    if (normalized.includes("transferencia") && text.startsWith("Transferencia #")) return text;
    if (normalized.includes("transferencia") && isUuidLike(text)) {
      const tx = transfers.find((t) => t.id === text);
      if (tx) {
        return `Transferencia #${tx.transferCode ?? tx.id} · ${tx.quantity}u · ${tx.fromWarehouseId} -> ${tx.toWarehouseId}`;
      }
      return "Transferencia registrada";
    }

    if (
      normalized.includes("medicamento") ||
      normalized.includes("venta registrada")
    ) {
      if (isUuidLike(text)) {
        const med = medications.find((m) => m.id === text);
        return med
          ? `${med.name} ${med.concentrationValue}${med.concentrationUnit} · ${med.form}`
          : "Medicamento registrado";
      }
      return text;
    }

    if (normalized.includes("usuario")) {
      if (isUuidLike(text)) {
        const user = users.find((u) => u.id === text);
        return user ? `${user.name} (${user.role})` : "Usuario registrado";
      }
      return text;
    }

    if (normalized.includes("depósito")) {
      if (isUuidLike(text)) {
        const warehouse = warehouses.find((w) => w.id === text);
        return warehouse ? `${warehouse.name} (${warehouse.type})` : "Depósito registrado";
      }
      return text;
    }

    if (normalized.includes("pedido ")) {
      if (isUuidLike(text)) {
        const order = orders.find((o) => o.id === text);
        return order ? `Pedido de ${order.quantity}u · Paciente ${order.patient} · Habitación ${order.room}` : "Pedido registrado";
      }
      return text;
    }

    if (isUuidLike(text)) return "Referencia interna";
    return text;
  };

  const rows = useMemo(() => {
    return audit
      .map((a) => ({
        ...a,
        actionLabel: actionLabel(a.action),
        detailLabel: detailLabel(a.action, a.entity),
      }))
      .filter(
        (a) =>
          !q ||
          a.user.toLowerCase().includes(q.toLowerCase()) ||
          a.actionLabel.toLowerCase().includes(q.toLowerCase()) ||
          a.detailLabel.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [audit, q, medications, users, warehouses, orders, transfers]);

  return (
    <div>
      <PageHeader
        title="Registro de auditoría"
        description="Quién hizo qué, cuándo y con qué detalle. Trazabilidad completa de la operación."
      />
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario, acción o detalle..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      <ScrollText className="mx-auto mb-2 h-5 w-5 opacity-40" />
                      Sin registros
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.user}</TableCell>
                    <TableCell className="text-sm">{r.actionLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.detailLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

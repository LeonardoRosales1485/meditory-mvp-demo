import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExpiryBadge } from "@/components/expiry-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { daysUntil, expiryStatus, formatDate, medName, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";

export const Route = createFileRoute("/app/vencimientos")({
  component: ExpiryPage,
});

function ExpiryPage() {
  const { warehouseIds, warehouses } = useWarehouse();
  const batches = useStore((s) => s.batches);

  const [q, setQ] = useState("");
  const [whFilter, setWhFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("urgentes");

  const rows = useMemo(() => {
    return batches
      .filter((b) => warehouseIds.includes(b.warehouseId))
      .filter((b) => whFilter === "all" || b.warehouseId === whFilter)
      .filter((b) => {
        const st = expiryStatus(b.expiry);
        if (statusFilter === "all") return true;
        if (statusFilter === "urgentes") return st === "vencido" || st === "critico";
        return st === statusFilter;
      })
      .filter((b) => !q || medName(b.medicationId).toLowerCase().includes(q.toLowerCase()) || b.lot.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  }, [batches, warehouseIds, whFilter, statusFilter, q]);

  const expired = rows.filter((b) => expiryStatus(b.expiry) === "vencido");
  const critical = rows.filter((b) => expiryStatus(b.expiry) === "critico");
  const lostUnits = expired.reduce((acc, b) => acc + b.quantity, 0);

  return (
    <div>
      <PageHeader
        title="Control de vencimientos"
        description="Lotes ordenados por proximidad de vencimiento. Cero medicamentos vencidos sin detectar."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Vencidos</p>
            <p className="mt-2 text-3xl font-semibold text-destructive">{expired.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{lostUnits} u inutilizables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Críticos (≤30 días)</p>
            <p className="mt-2 text-3xl font-semibold text-warning">{critical.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Acción urgente recomendada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lotes monitoreados</p>
            <p className="mt-2 text-3xl font-semibold">{rows.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Filtro actual</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar medicamento o lote..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={whFilter} onValueChange={setWhFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los depósitos</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgentes">Urgentes (vencidos + ≤30d)</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="critico">Críticos (≤30d)</SelectItem>
                <SelectItem value="proximo">Próximos (≤90d)</SelectItem>
                <SelectItem value="ok">Vigentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      <AlertTriangle className="mx-auto mb-2 h-5 w-5 opacity-40" />
                      Sin lotes para los filtros seleccionados
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const days = daysUntil(r.expiry);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{medName(r.medicationId)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.lot}</TableCell>
                      <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                      <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.expiry)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {days < 0 ? `${Math.abs(days)} vencido` : `${days}d`}
                      </TableCell>
                      <TableCell><ExpiryBadge expiry={r.expiry} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";

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
import { expiryStatus, formatDate, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";

export const Route = createFileRoute("/app/inventario")({
  component: Inventory,
});

function Inventory() {
  const [q, setQ] = useState("");
  const [whFilter, setWhFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { warehouses, warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);

  const rows = useMemo(() => {
    return batches
      .filter((b) => warehouseIds.includes(b.warehouseId))
      .filter((b) => whFilter === "all" || b.warehouseId === whFilter)
      .filter((b) => statusFilter === "all" || expiryStatus(b.expiry) === statusFilter)
      .map((b) => {
        const m = medications.find((x) => x.id === b.medicationId);
        return { ...b, med: m };
      })
      .filter((r) => !!r.med)
      .filter(
        (r) =>
          !q ||
          r.med!.name.toLowerCase().includes(q.toLowerCase()) ||
          r.lot.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  }, [q, whFilter, statusFilter, batches, medications, warehouseIds]);

  const batchesInScope = useMemo(
    () => batches.filter((b) => warehouseIds.includes(b.warehouseId)),
    [batches, warehouseIds],
  );
  const showLoading = workspaceDataLoading && batchesInScope.length === 0;
  const filtersActive = q !== "" || whFilter !== "all" || statusFilter !== "all";
  const showEmptyTable = !workspaceDataLoading && rows.length === 0 && !filtersActive;
  const showNoResults = !workspaceDataLoading && rows.length === 0 && filtersActive;

  return (
    <div>
      <PageHeader
        title="Inventario por lote"
        description="Stock detallado por medicamento, lote y depósito."
      />
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
                disabled={showLoading}
              />
            </div>
            <Select value={whFilter} onValueChange={setWhFilter} disabled={showLoading}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los depósitos</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={showLoading}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="critico">Críticos (≤30d)</SelectItem>
                <SelectItem value="proximo">Próximos (≤90d)</SelectItem>
                <SelectItem value="ok">Vigentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            {showLoading ? (
              <WorkspaceLoadingPlaceholder
                title="Cargando inventario"
                description="Sincronizando lotes y stock…"
              />
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showEmptyTable && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                      <p className="font-medium text-foreground">No hay lotes en inventario</p>
                      <p className="mt-1 max-w-md mx-auto text-xs">
                        Cuando registres ingresos o transferencias recibidas, aparecerán aquí por medicamento, lote y depósito.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {showNoResults && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      No hay resultados con los filtros actuales. Probá otra búsqueda o restablecé los filtros.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.med!.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.med!.concentrationValue}{r.med!.concentrationUnit} · {r.med!.form}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.lot}</TableCell>
                    <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                    <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.expiry)}
                    </TableCell>
                    <TableCell>
                      <ExpiryBadge expiry={r.expiry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
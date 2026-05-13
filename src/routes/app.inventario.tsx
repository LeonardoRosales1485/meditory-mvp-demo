import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { daysUntil, expiryStatus, formatDate, medConc, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

export type InventarioSearch = {
  /** Id de medicamento del catálogo para filtrar lotes */
  medicamento?: string;
};

export const Route = createFileRoute("/app/inventario")({
  validateSearch: (raw: Record<string, unknown>): InventarioSearch => {
    const medicamento = raw.medicamento;
    return {
      medicamento:
        typeof medicamento === "string" && medicamento.trim().length > 0
          ? medicamento.trim()
          : undefined,
    };
  },
  component: Inventory,
});

function Inventory() {
  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [medicationFilter, setMedicationFilter] = useState<string>("all");
  const [whFilter, setWhFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-inventario");
  const { warehouses, warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);

  const medicationIdsInScope = useMemo(() => {
    const ids = new Set<string>();
    for (const b of batches) {
      if (!warehouseIds.includes(b.warehouseId)) continue;
      if (whFilter !== "all" && b.warehouseId !== whFilter) continue;
      if (medications.some((m) => m.id === b.medicationId)) ids.add(b.medicationId);
    }
    return ids;
  }, [batches, warehouseIds, whFilter, medications]);

  const medicationsInInventory = useMemo(() => {
    return medications
      .filter((m) => medicationIdsInScope.has(m.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [medications, medicationIdsInScope]);

  /** Incluye el medicamento del filtro aunque aún no tenga lotes en depósitos visibles (p. ej. enlace desde catálogo). */
  const medicationsForSelect = useMemo(() => {
    const byId = new Map(medicationsInInventory.map((m) => [m.id, m]));
    if (medicationFilter !== "all") {
      const extra = medications.find((m) => m.id === medicationFilter);
      if (extra && !byId.has(extra.id)) byId.set(extra.id, extra);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [medicationsInInventory, medicationFilter, medications]);

  useEffect(() => {
    const id = search.medicamento;
    if (!id || !medications.some((m) => m.id === id)) return;
    setMedicationFilter(id);
  }, [search.medicamento, medications]);

  useEffect(() => {
    if (medicationFilter === "all") return;
    if (!medications.some((m) => m.id === medicationFilter)) setMedicationFilter("all");
  }, [medicationFilter, medications]);

  const rows = useMemo(() => {
    return batches
      .filter((b) => warehouseIds.includes(b.warehouseId))
      .filter((b) => whFilter === "all" || b.warehouseId === whFilter)
      .filter((b) => medicationFilter === "all" || b.medicationId === medicationFilter)
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
  }, [q, whFilter, statusFilter, medicationFilter, batches, medications, warehouseIds]);

  const batchesInScope = useMemo(
    () => batches.filter((b) => warehouseIds.includes(b.warehouseId)),
    [batches, warehouseIds],
  );
  const showLoading = workspaceDataLoading && batchesInScope.length === 0;
  const filtersActive =
    q !== "" || medicationFilter !== "all" || whFilter !== "all" || statusFilter !== "all";
  const showEmptyTable = !workspaceDataLoading && rows.length === 0 && !filtersActive;
  const showNoResults = !workspaceDataLoading && rows.length === 0 && filtersActive;

  const filterSummary = useMemo(() => {
    let totalQty = 0;
    for (const r of rows) {
      totalQty += r.quantity;
    }
    /** Stock del lote con vencimiento más cercano (solo no vencidos); si hay varios con la misma fecha, se suman. */
    let nearExpiryQty = 0;
    const futureRows = rows.filter((r) => daysUntil(r.expiry) >= 0);
    if (futureRows.length > 0) {
      const sorted = [...futureRows].sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
      const earliestMs = +new Date(sorted[0]!.expiry);
      for (const r of sorted) {
        if (+new Date(r.expiry) === earliestMs) nearExpiryQty += r.quantity;
        else break;
      }
    }
    return { totalQty, nearExpiryQty, lotCount: rows.length };
  }, [rows]);

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
            <Select
              value={medicationFilter}
              onValueChange={setMedicationFilter}
              disabled={showLoading}
            >
              <SelectTrigger className="w-full min-w-[200px] sm:w-[260px]">
                <SelectValue placeholder="Medicamento en inventario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los medicamentos</SelectItem>
                {medicationsForSelect.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="max-w-[min(90vw,360px)]">
                    <span className="line-clamp-2">
                      {m.name} · {medConc(m)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {filtersActive && !showLoading && (
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
              <p>
                <span className="text-muted-foreground">Cantidad total: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {filterSummary.totalQty.toLocaleString("es-AR")} u
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Cantidad próxima a vencer: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {filterSummary.nearExpiryQty.toLocaleString("es-AR")} u
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Lotes involucrados: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {filterSummary.lotCount.toLocaleString("es-AR")}
                </span>
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            {isMobile && (
              <div className="mb-3">
                <MobileViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            {showLoading ? (
              <WorkspaceLoadingPlaceholder
                title="Cargando inventario"
                description="Sincronizando lotes y stock…"
              />
            ) : isMobile && viewMode === "cards" ? (
              <div className="space-y-3">
                {showEmptyTable && (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                    <p className="font-medium text-foreground">No hay lotes en inventario</p>
                  </div>
                )}
                {showNoResults && (
                  <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                    No hay resultados con los filtros actuales.
                  </div>
                )}
                {rows.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                      <p className="text-sm font-semibold text-foreground">
                        {r.med!.name} · {r.med!.concentrationValue}{r.med!.concentrationUnit}
                      </p>
                      <p>Lote: {r.lot}</p>
                      <p>Depósito: {warehouseName(r.warehouseId)}</p>
                      <p>Vencimiento: {formatDate(r.expiry)}</p>
                      <p>Cantidad: <span className="font-semibold text-foreground">{r.quantity} u</span></p>
                      <ExpiryBadge expiry={r.expiry} />
                    </CardContent>
                  </Card>
                ))}
              </div>
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
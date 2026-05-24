import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExpiryBadge } from "@/components/expiry-badge";
import { StockConfigDialog } from "@/components/stock-config-dialog";
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
import { daysUntil, expiryStatus, formatDate, medConc, warehouseName, type Medication } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type InventoryTab = "medicamentos" | "lotes";

function formatWarehouseDistribution(
  byWarehouseId: Map<string, number>,
  warehousesSorted: { id: string; name: string }[],
) {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const w of warehousesSorted) {
    seen.add(w.id);
    const qty = byWarehouseId.get(w.id) ?? 0;
    if (qty > 0) parts.push(`${w.name}: ${qty.toLocaleString("es-AR")} u`);
  }
  for (const [id, qty] of byWarehouseId) {
    if (seen.has(id) || qty <= 0) continue;
    parts.push(`${warehouseName(id)}: ${qty.toLocaleString("es-AR")} u`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function Inventory() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("medicamentos");
  const [q, setQ] = useState("");
  const [medicationFilter, setMedicationFilter] = useState<string>("all");
  const [whFilter, setWhFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-inventario");
  const { warehouses, warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const session = useStore((s) => s.session);
  const isAdmin = session?.role === "admin";
  const [editConfig, setEditConfig] = useState<{
    medicationId: string;
    medicationName: string;
    warehouseId: string;
    warehouseName: string;
    workspaceName: string;
    qty: number;
    min: number;
    opt: number;
  } | null>(null);

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

  const lotRows = useMemo(() => {
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

  const warehousesSorted = useMemo(
    () => [...warehouses].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [warehouses],
  );

  const medInventoryRows = useMemo(() => {
    const map = new Map<string, { med: Medication; total: number; byWarehouseId: Map<string, number> }>();
    for (const r of lotRows) {
      const m = r.med!;
      let entry = map.get(m.id);
      if (!entry) {
        entry = { med: m, total: 0, byWarehouseId: new Map() };
        map.set(m.id, entry);
      }
      entry.total += r.quantity;
      const prev = entry.byWarehouseId.get(r.warehouseId) ?? 0;
      entry.byWarehouseId.set(r.warehouseId, prev + r.quantity);
    }
    return [...map.values()].sort((a, b) => a.med.name.localeCompare(b.med.name, "es"));
  }, [lotRows]);

  const batchesInScope = useMemo(
    () => batches.filter((b) => warehouseIds.includes(b.warehouseId)),
    [batches, warehouseIds],
  );
  const showLoading = workspaceDataLoading && batchesInScope.length === 0;
  const filtersActive =
    q !== "" || medicationFilter !== "all" || whFilter !== "all" || statusFilter !== "all";
  const showEmptyLots = !workspaceDataLoading && lotRows.length === 0 && !filtersActive;
  const showNoResultsLots = !workspaceDataLoading && lotRows.length === 0 && filtersActive;
  const showEmptyMeds = !workspaceDataLoading && medInventoryRows.length === 0 && !filtersActive;
  const showNoResultsMeds = !workspaceDataLoading && medInventoryRows.length === 0 && filtersActive;

  const filterSummary = useMemo(() => {
    let totalQty = 0;
    for (const r of lotRows) {
      totalQty += r.quantity;
    }
    /** Stock del lote con vencimiento más cercano (solo no vencidos); si hay varios con la misma fecha, se suman. */
    let nearExpiryQty = 0;
    const futureRows = lotRows.filter((r) => daysUntil(r.expiry) >= 0);
    if (futureRows.length > 0) {
      const sorted = [...futureRows].sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
      const earliestMs = +new Date(sorted[0]!.expiry);
      for (const r of sorted) {
        if (+new Date(r.expiry) === earliestMs) nearExpiryQty += r.quantity;
        else break;
      }
    }
    return { totalQty, nearExpiryQty, lotCount: lotRows.length };
  }, [lotRows]);

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Stock total por medicamento y detalle por lote en tus depósitos."
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
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los depósitos</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={showLoading}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
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
          {showLoading ? (
            <WorkspaceLoadingPlaceholder
              title="Cargando inventario"
              description="Sincronizando lotes y stock…"
            />
          ) : (
            <Tabs
              value={inventoryTab}
              onValueChange={(v) => {
                const tab = v as InventoryTab;
                setInventoryTab(tab);
                if (tab !== "medicamentos") return;
                setQ("");
                setMedicationFilter("all");
                setWhFilter("all");
                setStatusFilter("all");
                void navigate({ to: "/app/inventario", search: {}, replace: true });
              }}
            >
              <TabsList className="grid w-full max-w-lg grid-cols-2">
                <TabsTrigger value="medicamentos">Vista por medicamentos</TabsTrigger>
                <TabsTrigger value="lotes">Vista por lotes</TabsTrigger>
              </TabsList>
              <TabsContent value="medicamentos" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {showEmptyMeds && (
                    <div className="col-span-full rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                      <p className="font-medium text-foreground">No hay stock en inventario</p>
                      <p className="mt-1 max-w-md mx-auto text-xs">
                        Cuando registres ingresos o transferencias recibidas, verás aquí totales por medicamento y
                        depósito.
                      </p>
                    </div>
                  )}
                  {showNoResultsMeds && (
                    <div className="col-span-full rounded-lg border p-4 text-center text-sm text-muted-foreground">
                      No hay resultados con los filtros actuales. Probá otra búsqueda o restablecé los filtros.
                    </div>
                  )}
                  {medInventoryRows.map((row) => (
                    <Card key={row.med.id} className="overflow-hidden">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug text-foreground">
                              {row.med.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {medConc(row.med)} · {row.med.form}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 text-xs"
                                onClick={() => {
                                  const whId = warehouseIds[0] ?? '';
                                  const wh = warehouses.find((w) => w.id === whId);
                                  setEditConfig({
                                    medicationId: row.med.id,
                                    medicationName: row.med.name,
                                    warehouseId: whId,
                                    warehouseName: wh?.name ?? 'Depósito',
                                    workspaceName: session?.workspaceName ?? '',
                                    qty: row.total,
                                    min: 0,
                                    opt: 0,
                                  });
                                }}
                              >
                                Config. stock
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-xs"
                              onClick={() => {
                                setMedicationFilter(row.med.id);
                                setInventoryTab("lotes");
                                void navigate({
                                  to: "/app/inventario",
                                  search: { medicamento: row.med.id },
                                  replace: true,
                                });
                              }}
                            >
                              Ver lotes
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {row.total.toLocaleString("es-AR")} u
                          </span>
                        </p>
                        <div className="border-t border-border pt-3">
                          <p className="mb-1.5 text-xs font-medium text-foreground">Por depósito</p>
                          <p className="break-words text-xs leading-relaxed text-muted-foreground">
                            {formatWarehouseDistribution(row.byWarehouseId, warehousesSorted)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="lotes" className="mt-4">
                <div className="overflow-x-auto">
                  {isMobile && (
                    <div className="mb-3">
                      <MobileViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                  )}
                  {isMobile && viewMode === "cards" ? (
                    <div className="space-y-3">
                      {showEmptyLots && (
                        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                          <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                          <p className="font-medium text-foreground">No hay lotes en inventario</p>
                        </div>
                      )}
                      {showNoResultsLots && (
                        <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                          No hay resultados con los filtros actuales.
                        </div>
                      )}
                      {lotRows.map((r) => (
                        <Card key={r.id}>
                          <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                            <p className="text-sm font-semibold text-foreground">
                              {r.med!.name} · {r.med!.concentrationValue}
                              {r.med!.concentrationUnit}
                            </p>
                            <p>Lote: {r.lot}</p>
                            <p>Depósito: {warehouseName(r.warehouseId)}</p>
                            <p>Vencimiento: {formatDate(r.expiry)}</p>
                            <p>
                              Cantidad: <span className="font-semibold text-foreground">{r.quantity} u</span>
                            </p>
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
                        {showEmptyLots && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                              <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                              <p className="font-medium text-foreground">No hay lotes en inventario</p>
                              <p className="mt-1 max-w-md mx-auto text-xs">
                                Cuando registres ingresos o transferencias recibidas, aparecerán aquí por medicamento,
                                lote y depósito.
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                        {showNoResultsLots && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                              No hay resultados con los filtros actuales. Probá otra búsqueda o restablecé los filtros.
                            </TableCell>
                          </TableRow>
                        )}
                        {lotRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-medium">{r.med!.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.med!.concentrationValue}
                                {r.med!.concentrationUnit} · {r.med!.form}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.lot}</TableCell>
                            <TableCell>{warehouseName(r.warehouseId)}</TableCell>
                            <TableCell className="text-right font-semibold">{r.quantity}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(r.expiry)}</TableCell>
                            <TableCell>
                              <ExpiryBadge expiry={r.expiry} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {editConfig && (
        <StockConfigDialog
          open={!!editConfig}
          onOpenChange={(open) => { if (!open) setEditConfig(null); }}
          medicationName={editConfig.medicationName}
          warehouseName={editConfig.warehouseName}
          workspaceName={editConfig.workspaceName}
          currentMin={editConfig.min}
          currentOpt={editConfig.opt}
          currentQty={editConfig.qty}
          onSave={async (minStock, optimalStock) => {
            const { updateStockConfigRpc } = await import("@/lib/server-rpc");
            await updateStockConfigRpc({
              data: {
                actor: session?.name ?? '',
                workspaceId: session?.workspaceId ?? '',
                medicationId: editConfig.medicationId,
                warehouseId: editConfig.warehouseId,
                minStock,
                optimalStock,
              },
            });
            setEditConfig(null);
          }}
        />
      )}
    </div>
  );
}
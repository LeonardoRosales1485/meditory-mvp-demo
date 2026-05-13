import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useEffect, useMemo, useState } from "react";
import { Sliders, Search, Loader2, History } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  expiryStatus,
  formatDate,
  medName,
  warehouseName,
  type Batch,
  type Movement,
} from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { cn } from "@/lib/utils";

export type AjustesSearch = {
  /** Id de lote (`batches.id`) para filtrar el historial de ajustes */
  batchId?: string;
};

export const Route = createFileRoute("/app/ajustes")({
  beforeLoad: requireAdmin,
  validateSearch: (raw: Record<string, unknown>): AjustesSearch => {
    const batchId = raw.batchId;
    return {
      batchId:
        typeof batchId === "string" && batchId.trim().length > 0 ? batchId.trim() : undefined,
    };
  },
  component: AdjustmentsPage,
});

/** Ajustes manuales o descarte vinculados a un lote concreto (por columna `lot` o texto legacy en `reason`). */
function adjustmentMovementMatchesBatch(m: Movement, b: Batch): boolean {
  if (m.type !== "ajuste") return false;
  if (m.medicationId !== b.medicationId || m.warehouseId !== b.warehouseId) return false;
  if (m.lot && m.lot === b.lot) return true;
  if (!m.lot) {
    if (m.reason.startsWith(`Ajuste lote ${b.lot}:`)) return true;
    if (m.reason.includes(`Descarte por vencimiento · lote ${b.lot}`)) return true;
  }
  return false;
}

function formatMovementDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AdjustmentsPage() {
  const search = Route.useSearch();
  const { warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches);
  const movements = useStore((s) => s.movements);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const adjustStock = useStore((s) => s.adjustStock);

  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Batch | null>(null);
  const [discardTarget, setDiscardTarget] = useState<Batch | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [submittingDiscard, setSubmittingDiscard] = useState(false);
  const [mainTab, setMainTab] = useState<"lotes" | "historial">("lotes");
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-ajustes");

  const filterBatch = useMemo(() => {
    const id = search.batchId;
    if (!id) return null;
    const b = batches.find((x) => x.id === id);
    if (!b || !warehouseIds.includes(b.warehouseId)) return null;
    return b;
  }, [search.batchId, batches, warehouseIds]);

  const invalidBatchFilter = Boolean(search.batchId && !filterBatch);

  const rows = useMemo(() => {
    return batches
      .filter((b) => warehouseIds.includes(b.warehouseId))
      .filter(
        (b) =>
          !q ||
          medName(b.medicationId).toLowerCase().includes(q.toLowerCase()) ||
          b.lot.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  }, [batches, warehouseIds, q]);

  const adjustmentHistory = useMemo(() => {
    const list = movements.filter((m) => m.type === "ajuste").filter((m) => warehouseIds.includes(m.warehouseId));
    const filtered = filterBatch
      ? list.filter((m) => adjustmentMovementMatchesBatch(m, filterBatch))
      : list;
    return filtered.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [movements, warehouseIds, filterBatch]);

  const batchesInScope = useMemo(
    () => batches.filter((b) => warehouseIds.includes(b.warehouseId)),
    [batches, warehouseIds],
  );
  const showLoading = workspaceDataLoading && batchesInScope.length === 0;
  const showEmptyTable = !workspaceDataLoading && rows.length === 0 && !q;
  const showNoResults = !workspaceDataLoading && rows.length === 0 && !!q;
  const showEmptyHistory = !workspaceDataLoading && adjustmentHistory.length === 0 && !filterBatch;
  const showEmptyHistoryFiltered =
    !workspaceDataLoading && adjustmentHistory.length === 0 && !!filterBatch;

  useEffect(() => {
    if (search.batchId) setMainTab("historial");
  }, [search.batchId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingAdjust) return;
    if (!target) return;
    const d = parseInt(delta, 10);
    if (Number.isNaN(d) || d === 0) return toast.error("Diferencia inválida");
    if (!reason) return toast.error("El motivo es obligatorio");
    try {
      setSubmittingAdjust(true);
      await adjustStock({ batchId: target.id, delta: d, reason });
      toast.success(`Stock ajustado · ${d > 0 ? "+" : ""}${d} u`, { description: `Lote ${target.lot}` });
      setTarget(null);
      setDelta("");
      setReason("");
    } finally {
      setSubmittingAdjust(false);
    }
  }

  async function submitDiscard() {
    if (submittingDiscard) return;
    if (!discardTarget) return;
    try {
      setSubmittingDiscard(true);
      await adjustStock({
        batchId: discardTarget.id,
        delta: -discardTarget.quantity,
        reason: `Descarte por vencimiento · lote ${discardTarget.lot}`,
      });
      toast.success("Lote descartado", { description: `Lote ${discardTarget.lot} removido por vencimiento.` });
      setDiscardTarget(null);
    } finally {
      setSubmittingDiscard(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajustes manuales de stock"
        description="Correcciones por mermas, roturas, recuentos físicos. Cada ajuste queda auditado."
      />
      <Card>
        <div className="flex flex-wrap gap-1 border-b border-border px-3 pt-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMainTab("lotes")}
            className={cn(
              "relative -mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
              mainTab === "lotes"
                ? "border-border border-b-background bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lotes a ajustar
          </button>
          <button
            type="button"
            onClick={() => setMainTab("historial")}
            className={cn(
              "relative -mb-px rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
              mainTab === "historial"
                ? "border-border border-b-background bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Historial de ajustes
          </button>
        </div>
        <CardContent className="p-4">
          {mainTab === "lotes" ? (
            <>
              <div className="relative mb-4 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar medicamento o lote..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                  disabled={showLoading}
                />
              </div>
              <div className="overflow-x-auto">
                {isMobile && (
                  <div className="mb-3">
                    <MobileViewToggle value={viewMode} onChange={setViewMode} />
                  </div>
                )}
                {showLoading ? (
                  <WorkspaceLoadingPlaceholder
                    title="Cargando lotes"
                    description="Obteniendo stock por depósito…"
                  />
                ) : isMobile && viewMode === "cards" ? (
                  <div className="space-y-3">
                    {showEmptyTable && (
                      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                        <Sliders className="mx-auto mb-2 h-8 w-8 opacity-35" />
                        <p className="font-medium text-foreground">Sin lotes para ajustar</p>
                      </div>
                    )}
                    {showNoResults && (
                      <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                        No hay lotes que coincidan con la búsqueda.
                      </div>
                    )}
                    {rows.map((b) => (
                      <Card key={b.id}>
                        <CardContent className="space-y-2 p-4">
                          <p className="text-sm font-semibold">{medName(b.medicationId)}</p>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Lote: {b.lot}</p>
                            <p>Depósito: {warehouseName(b.warehouseId)}</p>
                            <p>Vencimiento: {formatDate(b.expiry)}</p>
                            <p>
                              Cantidad:{" "}
                              <span className="font-semibold text-foreground">{b.quantity} u</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to="/app/ajustes"
                              search={{ batchId: b.id }}
                              onClick={() => setMainTab("historial")}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              <History className="mr-1.5 h-3.5 w-3.5" />
                              Historial
                            </Link>
                            {expiryStatus(b.expiry) === "vencido" ? (
                              <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(b)}>
                                Descartar lote
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTarget(b);
                                  setDelta("");
                                  setReason("");
                                }}
                              >
                                Ajustar
                              </Button>
                            )}
                          </div>
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
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showEmptyTable && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                            <Sliders className="mx-auto mb-2 h-8 w-8 opacity-35" />
                            <p className="font-medium text-foreground">Sin lotes para ajustar</p>
                            <p className="mt-1 max-w-md mx-auto text-xs">
                              Necesitás stock en los depósitos visibles. Registrá ingresos o completá transferencias
                              recibidas para poder corregir cantidades.
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                      {showNoResults && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            No hay lotes que coincidan con la búsqueda.
                          </TableCell>
                        </TableRow>
                      )}
                      {rows.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{medName(b.medicationId)}</TableCell>
                          <TableCell className="font-mono text-xs">{b.lot}</TableCell>
                          <TableCell>{warehouseName(b.warehouseId)}</TableCell>
                          <TableCell className="text-right font-semibold">{b.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(b.expiry)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Link
                                to="/app/ajustes"
                                search={{ batchId: b.id }}
                                onClick={() => setMainTab("historial")}
                                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                              >
                                <History className="mr-1.5 h-3.5 w-3.5" />
                                Historial
                              </Link>
                              {expiryStatus(b.expiry) === "vencido" ? (
                                <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(b)}>
                                  Descartar lote
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTarget(b);
                                    setDelta("");
                                    setReason("");
                                  }}
                                >
                                  Ajustar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Historial de ajustes</h2>
                  <p className="text-sm text-muted-foreground">
                    Movimientos de tipo ajuste en los depósitos a los que tenés acceso.
                  </p>
                </div>
                {invalidBatchFilter ? (
                  <p className="text-sm text-destructive">
                    El lote del enlace no existe o no tenés acceso al depósito. Se muestran todos los ajustes.
                  </p>
                ) : filterBatch ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      Lote <span className="font-mono text-foreground">{filterBatch.lot}</span> ·{" "}
                      {medName(filterBatch.medicationId)}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/app/ajustes">Ver todos</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
              {workspaceDataLoading && movements.length === 0 ? (
                <WorkspaceLoadingPlaceholder
                  title="Cargando historial"
                  description="Sincronizando movimientos…"
                />
              ) : isMobile && viewMode === "cards" ? (
                <div className="space-y-3">
                  <div className="mb-1">
                    <MobileViewToggle value={viewMode} onChange={setViewMode} />
                  </div>
                  {showEmptyHistory && (
                    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      Todavía no hay ajustes registrados en este workspace.
                    </div>
                  )}
                  {showEmptyHistoryFiltered && (
                    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      No hay ajustes registrados para este lote.
                    </div>
                  )}
                  {adjustmentHistory.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                        <p className="text-sm font-semibold text-foreground">{medName(m.medicationId)}</p>
                        <p>{formatMovementDate(m.date)}</p>
                        {m.lot ? <p className="font-mono">Lote: {m.lot}</p> : null}
                        <p>Depósito: {warehouseName(m.warehouseId)}</p>
                        <p>
                          Diferencia:{" "}
                          <span
                            className={
                              m.quantity < 0
                                ? "font-semibold text-destructive"
                                : m.quantity > 0
                                  ? "font-semibold text-emerald-700"
                                  : "font-semibold text-foreground"
                            }
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {m.quantity} u
                          </span>
                        </p>
                        <p>Usuario: {m.user}</p>
                        <p className="text-foreground/90">{m.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {isMobile && (
                    <div className="mb-3 px-1">
                      <MobileViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Medicamento</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Depósito</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showEmptyHistory && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            Todavía no hay ajustes registrados en este workspace.
                          </TableCell>
                        </TableRow>
                      )}
                      {showEmptyHistoryFiltered && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            No hay ajustes registrados para este lote.
                          </TableCell>
                        </TableRow>
                      )}
                      {adjustmentHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatMovementDate(m.date)}
                          </TableCell>
                          <TableCell className="font-medium">{medName(m.medicationId)}</TableCell>
                          <TableCell className="font-mono text-xs">{m.lot ?? "—"}</TableCell>
                          <TableCell>{warehouseName(m.warehouseId)}</TableCell>
                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              m.quantity < 0 ? "text-destructive" : m.quantity > 0 ? "text-emerald-700" : ""
                            }`}
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {m.quantity} u
                          </TableCell>
                          <TableCell className="text-sm">{m.user}</TableCell>
                          <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                            <span className="line-clamp-2">{m.reason}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  Lote <span className="font-mono">{target.lot}</span> · {medName(target.medicationId)} · stock
                  actual: {target.quantity} u
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Diferencia (use negativo para descontar)</Label>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-5" />
              {target && delta && (
                <p className="text-xs text-muted-foreground">
                  Nuevo stock:{" "}
                  <span className="font-medium text-foreground">
                    {Math.max(0, target.quantity + (parseInt(delta, 10) || 0))} u
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Recuento físico, rotura, merma..."
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={submittingAdjust}
                className={submittingAdjust ? "bg-muted text-muted-foreground hover:bg-muted" : undefined}
              >
                {submittingAdjust ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar ajuste"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar lote vencido</DialogTitle>
            <DialogDescription>
              {discardTarget && (
                <>
                  Vas a descartar completamente el lote <span className="font-mono">{discardTarget.lot}</span> de{" "}
                  {medName(discardTarget.medicationId)} ({discardTarget.quantity} u).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)} disabled={submittingDiscard}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitDiscard} disabled={submittingDiscard}>
              {submittingDiscard ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar descarte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

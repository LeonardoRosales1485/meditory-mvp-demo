import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useMemo, useState } from "react";
import { Sliders, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { expiryStatus, formatDate, medName, warehouseName, type Batch } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

export const Route = createFileRoute("/app/ajustes")({
  beforeLoad: requireAdmin,
  component: AdjustmentsPage,
});

function AdjustmentsPage() {
  const { warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const adjustStock = useStore((s) => s.adjustStock);

  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Batch | null>(null);
  const [discardTarget, setDiscardTarget] = useState<Batch | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [submittingDiscard, setSubmittingDiscard] = useState(false);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-ajustes");

  const rows = useMemo(() => {
    return batches
      .filter((b) => warehouseIds.includes(b.warehouseId))
      .filter((b) => !q || medName(b.medicationId).toLowerCase().includes(q.toLowerCase()) || b.lot.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  }, [batches, warehouseIds, q]);

  const batchesInScope = useMemo(
    () => batches.filter((b) => warehouseIds.includes(b.warehouseId)),
    [batches, warehouseIds],
  );
  const showLoading = workspaceDataLoading && batchesInScope.length === 0;
  const showEmptyTable = !workspaceDataLoading && rows.length === 0 && !q;
  const showNoResults = !workspaceDataLoading && rows.length === 0 && !!q;

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
    <div>
      <PageHeader
        title="Ajustes manuales de stock"
        description="Correcciones por mermas, roturas, recuentos físicos. Cada ajuste queda auditado."
      />
      <Card>
        <CardContent className="p-4">
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
                        <p>Cantidad: <span className="font-semibold text-foreground">{b.quantity} u</span></p>
                      </div>
                      {expiryStatus(b.expiry) === "vencido" ? (
                        <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(b)}>
                          Descartar lote
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setTarget(b); setDelta(""); setReason(""); }}>
                          Ajustar
                        </Button>
                      )}
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
                  <TableHead className="text-right">Ajuste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showEmptyTable && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      <Sliders className="mx-auto mb-2 h-8 w-8 opacity-35" />
                      <p className="font-medium text-foreground">Sin lotes para ajustar</p>
                      <p className="mt-1 max-w-md mx-auto text-xs">
                        Necesitás stock en los depósitos visibles. Registrá ingresos o completá transferencias recibidas para poder corregir cantidades.
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
                      {expiryStatus(b.expiry) === "vencido" ? (
                        <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(b)}>
                          Descartar lote
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setTarget(b); setDelta(""); setReason(""); }}>
                          Ajustar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              {target && <>Lote <span className="font-mono">{target.lot}</span> · {medName(target.medicationId)} · stock actual: {target.quantity} u</>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Diferencia (use negativo para descontar)</Label>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-5" />
              {target && delta && (
                <p className="text-xs text-muted-foreground">
                  Nuevo stock: <span className="font-medium text-foreground">{Math.max(0, target.quantity + (parseInt(delta, 10) || 0))} u</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recuento físico, rotura, merma..." />
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

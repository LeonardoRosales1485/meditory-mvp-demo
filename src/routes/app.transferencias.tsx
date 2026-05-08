import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOrTecnico } from "@/lib/route-guards";
import { useState } from "react";
import { ArrowRight, ArrowLeftRight, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, medName, warehouseName } from "@/lib/domain-types";
import { stockFor, useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/transferencias")({
  beforeLoad: requireAdminOrTecnico,
  component: Transfers,
});

const labels: Record<string, string> = {
  solicitado: "Autorizar",
  autorizado: "Despachar",
  despachado: "Pasar a recibir",
  recibir: "Confirmar recepción",
  recibido: "Aceptar recepción",
};

function Transfers() {
  const { warehouses, warehouseIds } = useWarehouse();
  const session = useStore((s) => s.session);
  const storeWarehouses = useStore((s) => s.warehouses);
  const allTransfers = useStore((s) => s.transfers);
  const medications = useStore((s) => s.medications);
  const batches = useStore((s) => s.batches);
  const audit = useStore((s) => s.audit);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const advance = useStore((s) => s.advanceTransfer);
  const reject = useStore((s) => s.rejectTransfer);
  const create = useStore((s) => s.createTransfer);

  const [open, setOpen] = useState(false);
  const [med, setMed] = useState("");
  const [sourceBatchId, setSourceBatchId] = useState("");
  const centralWarehouse = storeWarehouses.find(
    (w) => w.workspaceId === session?.workspaceId && w.type === "central",
  );
  const destinationWarehouses = warehouses.filter((w) => w.type !== "central");
  const [to, setTo] = useState(destinationWarehouses[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [confirmAdvance, setConfirmAdvance] = useState<null | {
    id: string;
    status: string;
    qty: number;
    fromId: string;
    medId: string;
    requestedBy: string;
  }>(null);
  const [confirmReject, setConfirmReject] = useState<null | {
    id: string;
    medId: string;
    fromId: string;
    toId: string;
    qty: number;
  }>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCustomReason, setRejectCustomReason] = useState("");
  const [rejectOutcome, setRejectOutcome] = useState<"devolver" | "descartar">("devolver");
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [ackReceiveOnBehalf, setAckReceiveOnBehalf] = useState(false);
  const [creating, setCreating] = useState(false);

  const transfers = allTransfers.filter(
    (t) => warehouseIds.includes(t.fromWarehouseId) || warehouseIds.includes(t.toWarehouseId),
  );
  const availableBatches = batches
    .filter(
      (b) =>
        b.medicationId === med &&
        b.warehouseId === (centralWarehouse?.id ?? "") &&
        b.quantity > 0,
    )
    .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  const defaultBatch = availableBatches[0] ?? null;
  const selectedBatch =
    availableBatches.find((b) => b.id === sourceBatchId) ??
    defaultBatch ??
    null;
  const isNotNearestLot =
    !!selectedBatch && !!defaultBatch && selectedBatch.id !== defaultBatch.id;

  const showTransferTableLoading = workspaceDataLoading && transfers.length === 0;
  const showEmptyTransfers = !workspaceDataLoading && transfers.length === 0;
  const formDisabled = workspaceDataLoading && (medications.length === 0 || warehouses.length === 0);
  const cannotCreateTransfer =
    formDisabled || !centralWarehouse || destinationWarehouses.length === 0 || !selectedBatch;

  async function handleAdvance(id: string, status: string, qtyNeeded: number, fromId: string, medId: string) {
    if (advancing) return;
    if (status === "autorizado") {
      const available = stockFor(batches, medId, fromId);
      if (available < qtyNeeded) {
        toast.error("Stock insuficiente para despachar", {
          description: `Disponible: ${available} u · Solicitado: ${qtyNeeded} u`,
        });
        return;
      }
    }
    try {
      setAdvancing(true);
      await advance(id);
      toast.success("Estado actualizado");
      setConfirmAdvance(null);
      setAckReceiveOnBehalf(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo avanzar la transferencia.";
      toast.error("No se pudo confirmar el avance", { description: message });
    } finally {
      setAdvancing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (!med || !qty) return toast.error("Completá medicamento y cantidad");
    if (!centralWarehouse) return toast.error("No hay depósito central configurado");
    const selectedTarget = to || destinationWarehouses[0]?.id || "";
    if (!selectedTarget) return toast.error("No hay depósitos destino disponibles");
    if (centralWarehouse.id === selectedTarget) return toast.error("El destino no puede ser el depósito central");
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(quantity) || quantity <= 0) return toast.error("Cantidad inválida");
    if (!selectedBatch) return toast.error("Seleccioná un lote con stock disponible.");
    if (quantity > selectedBatch.quantity) {
      return toast.error("La cantidad supera el stock disponible en el lote seleccionado.");
    }
    try {
      setCreating(true);
      await create({
        medicationId: med,
        sourceBatchId: selectedBatch.id,
        fromWarehouseId: centralWarehouse.id,
        toWarehouseId: selectedTarget,
        quantity,
      });
      toast.success("Solicitud creada", { description: "Estado: solicitado" });
      setOpen(false);
      setMed("");
      setQty("");
      setTo(destinationWarehouses[0]?.id ?? "");
      setSourceBatchId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
      toast.error("No se pudo crear la solicitud", { description: message });
    } finally {
      setCreating(false);
    }
  }

  async function handleReject() {
    if (!confirmReject) return;
    const normalizedReason = rejectReason === "Otro" ? rejectCustomReason.trim() : rejectReason.trim();
    if (!normalizedReason) {
      toast.error("El motivo de rechazo es obligatorio.");
      return;
    }
    await reject(confirmReject.id, normalizedReason, rejectOutcome);
    toast.success("Transferencia rechazada");
    setConfirmReject(null);
    setRejectReason("");
    setRejectCustomReason("");
    setRejectOutcome("devolver");
  }

  const selectedTransfer = transfers.find((t) => t.id === selectedTransferId) ?? null;
  const transferHistory = selectedTransfer
    ? audit
        .filter(
          (entry) =>
            entry.action.toLowerCase().includes("transferencia") &&
            (entry.entity.includes(`Transferencia #${selectedTransfer.transferCode ?? selectedTransfer.id}`) ||
              entry.entity.includes(`Ref: ${selectedTransfer.id}`)),
        )
        .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    : [];
  const historyTone = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized.includes("solicitada")) return "border-muted bg-muted/40";
    if (normalized.includes("autorizado")) return "border-primary/40 bg-primary-soft/50";
    if (normalized.includes("despachado")) return "border-amber-300 bg-amber-50";
    if (normalized.includes("recibido")) return "border-blue-300 bg-blue-50";
    if (normalized.includes("aceptado")) return "border-emerald-300 bg-emerald-50";
    if (normalized.includes("rechazada")) return "border-destructive/40 bg-destructive/10";
    return "border-border bg-background";
  };

  return (
    <div>
      <PageHeader
        title="Transferencias entre depósitos"
        description="Flujo: solicitado → autorizado → despachado → recibido → aceptado (o rechazado)."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={showTransferTableLoading}>Nueva solicitud</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva solicitud de transferencia</DialogTitle>
                <DialogDescription>
                  El stock se descuenta del origen al despachar y se acredita al destino al aceptar la recepción.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Medicamento</Label>
                  <Select value={med} onValueChange={setMed} disabled={formDisabled}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {medications.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.concentrationValue}{m.concentrationUnit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Desde</Label>
                    <Input value={centralWarehouse?.name ?? "Sin depósito central"} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Hacia</Label>
                    <Select value={to} onValueChange={setTo} disabled={formDisabled}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {destinationWarehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} disabled={formDisabled} />
                  {med && (
                    <p className="text-xs text-muted-foreground">
                      Stock total en origen: {stockFor(batches, med, centralWarehouse?.id ?? "")} u
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Lote de salida</Label>
                  <Select
                    value={selectedBatch?.id ?? ""}
                    onValueChange={setSourceBatchId}
                    disabled={!med || availableBatches.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar lote..." /></SelectTrigger>
                    <SelectContent>
                      {availableBatches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.lot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Vencimiento del lote</Label>
                      <Input value={selectedBatch ? formatDate(selectedBatch.expiry) : "—"} disabled />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Stock disponible del lote</Label>
                      <Input value={selectedBatch ? `${selectedBatch.quantity} u` : "—"} disabled />
                    </div>
                  </div>
                  {isNotNearestLot && (
                    <p className="text-xs text-amber-700">
                      Verificá que el lote seleccionado sea el más próximo a vencer.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={cannotCreateTransfer || creating}
                    className={cn(creating && "bg-muted text-muted-foreground hover:bg-muted")}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear solicitud"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="px-0">
          {showTransferTableLoading ? (
            <WorkspaceLoadingPlaceholder
              title="Cargando transferencias"
              description="Sincronizando solicitudes y estados…"
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Medicamento</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showEmptyTransfers && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    <ArrowLeftRight className="mx-auto mb-2 h-8 w-8 opacity-35" />
                    <p className="font-medium text-foreground">No hay transferencias</p>
                    <p className="mt-1 max-w-md mx-auto text-xs">
                      Creá una solicitud para mover stock entre depósitos. El flujo pasa por autorizar, despachar, recibir y aceptar.
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.transferCode ?? t.id}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => setSelectedTransferId(t.id)}
                    >
                      {medName(t.medicationId)}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{warehouseName(t.fromWarehouseId)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{warehouseName(t.toWarehouseId)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{t.quantity}</TableCell>
                  <TableCell className="text-sm">{t.requestedBy}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(t.date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedTransferId(t.id)}
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {labels[t.status] &&
                        (session?.role === "admin" ||
                          warehouseIds.includes(t.fromWarehouseId) ||
                          t.status === "despachado" ||
                          t.status === "recibir" ||
                          t.status === "recibido") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmAdvance({
                              id: t.id,
                              status: t.status,
                              qty: t.quantity,
                              fromId: t.fromWarehouseId,
                              medId: t.medicationId,
                              requestedBy: t.requestedBy,
                            })
                          }
                        >
                          {labels[t.status]}
                        </Button>
                      )}
                      {t.status === "recibido" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setConfirmReject({
                              id: t.id,
                              medId: t.medicationId,
                              fromId: t.fromWarehouseId,
                              toId: t.toWarehouseId,
                              qty: t.quantity,
                            })
                          }
                        >
                          Rechazar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmAdvance}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmAdvance(null);
            setAckReceiveOnBehalf(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar avance de transferencia</DialogTitle>
            <DialogDescription>
              Vas a avanzar la transferencia al siguiente paso del flujo.
            </DialogDescription>
          </DialogHeader>
          {confirmAdvance && (
            <div className="space-y-1.5 text-sm">
              <p><span className="font-medium">Medicamento:</span> {medName(confirmAdvance.medId)}</p>
              <p><span className="font-medium">Cantidad:</span> {confirmAdvance.qty} u</p>
              <p><span className="font-medium">Paso actual:</span> {confirmAdvance.status}</p>
              <p><span className="font-medium">Autoriza:</span> {session?.name ?? "Usuario actual"}</p>
              {session?.role === "admin" && confirmAdvance.status === "despachado" && (
                <label className="mt-2 flex items-start gap-2 rounded-md border p-2 text-xs">
                  <input
                    type="checkbox"
                    checked={ackReceiveOnBehalf}
                    onChange={(e) => setAckReceiveOnBehalf(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Usted como administrador se compromete a recibir en nombre de {confirmAdvance.requestedBy}.
                  </span>
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAdvance(null)} disabled={advancing}>Cancelar</Button>
            {confirmAdvance && (
              <Button
                disabled={advancing || (session?.role === "admin" && confirmAdvance.status === "despachado" && !ackReceiveOnBehalf)}
                onClick={() =>
                  handleAdvance(
                    confirmAdvance.id,
                    confirmAdvance.status,
                    confirmAdvance.qty,
                    confirmAdvance.fromId,
                    confirmAdvance.medId,
                  )
                }
              >
                {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmReject} onOpenChange={(o) => !o && setConfirmReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar transferencia</DialogTitle>
            <DialogDescription>
              Indicá motivo y resolución del rechazo post-recepción.
            </DialogDescription>
          </DialogHeader>
          {confirmReject && (
            <div className="space-y-3">
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium">Medicamento:</span> {medName(confirmReject.medId)}</p>
                <p><span className="font-medium">Ruta:</span> {warehouseName(confirmReject.fromId)} {"->"} {warehouseName(confirmReject.toId)}</p>
                <p><span className="font-medium">Cantidad:</span> {confirmReject.qty} u</p>
                <p><span className="font-medium">Autoriza:</span> {session?.name ?? "Usuario actual"}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo de rechazo</Label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Caja dañada">Caja dañada</SelectItem>
                    <SelectItem value="Caja abierta">Caja abierta</SelectItem>
                    <SelectItem value="Medicamento incorrecto">Medicamento incorrecto</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resolución de stock</Label>
                <Select value={rejectOutcome} onValueChange={(v) => setRejectOutcome(v as "devolver" | "descartar")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devolver">Devolver al depósito central</SelectItem>
                    <SelectItem value="descartar">Descartar unidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rejectReason === "Otro" && (
                <Input
                  value={rejectCustomReason}
                  onChange={(e) => setRejectCustomReason(e.target.value)}
                  placeholder="Indicá motivo específico"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReject(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Confirmar rechazo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTransfer} onOpenChange={(o) => !o && setSelectedTransferId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ciclo de vida de la transferencia</DialogTitle>
            <DialogDescription>
              {selectedTransfer
                ? `${medName(selectedTransfer.medicationId)} · ${warehouseName(selectedTransfer.fromWarehouseId)} -> ${warehouseName(selectedTransfer.toWarehouseId)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {transferHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay eventos auditados para esta transferencia.</p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-auto rounded-md border p-3">
              {transferHistory.map((entry, index) => (
                <div key={entry.id} className={cn("rounded-lg border p-3", historyTone(entry.action))}>
                  <div className="space-y-1.5 text-sm">
                    <p className="font-semibold text-foreground">{index + 1}. {entry.action}</p>
                    <div className="grid gap-1 text-xs">
                      <p><span className="font-medium text-foreground">Fecha:</span> <span className="text-muted-foreground">{formatDate(entry.date)}</span></p>
                      <p><span className="font-medium text-foreground">Usuario:</span> <span className="text-muted-foreground">{entry.user}</span></p>
                      <p><span className="font-medium text-foreground">Detalle:</span> <span className="text-muted-foreground">{entry.entity}</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Truck,
  Clock,
  PackageCheck,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore, stockFor } from "@/lib/store";
import { formatDate, medName, warehouseName } from "@/lib/domain-types";
import { requireAuth } from "@/lib/route-guards";
import { useWarehouse } from "@/lib/warehouse-context";

export const Route = createFileRoute("/app/pedidos")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Meditory — Pedidos" }] }),
  component: PedidosPage,
});

type OrderStatus =
  | "pendiente"
  | "aprobado"
  | "despachado"
  | "recibir"
  | "recibido"
  | "administrado"
  | "rechazado"
  | "devolucion_solicitada"
  | "devuelto"
  | "devolucion_rechazada";

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-muted text-foreground" },
    aprobado: { label: "Aprobado", className: "bg-primary-soft text-primary" },
    despachado: { label: "Despachado", className: "bg-amber-100 text-amber-700" },
    recibir: { label: "Recibir", className: "bg-blue-100 text-blue-700" },
    recibido: { label: "Recibido", className: "bg-sky-100 text-sky-700" },
    administrado: { label: "Administrado", className: "bg-violet-100 text-violet-700" },
    devolucion_solicitada: { label: "Devolución solicitada", className: "bg-orange-100 text-orange-700" },
    devuelto: { label: "Devuelto", className: "bg-success/15 text-success" },
    devolucion_rechazada: { label: "Devolución rechazada", className: "bg-destructive/10 text-destructive" },
    rechazado: { label: "Rechazado", className: "bg-destructive/10 text-destructive" },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

const EMPTY_FORM = { medicationId: "", sourceBatchId: "", patient: "", room: "", quantity: 1, reason: "" };

function DoctorView() {
  const session = useStore((s) => s.session);
  const medications = useStore((s) => s.medications);
  const batches = useStore((s) => s.batches);
  const orders = useStore((s) => s.orders);
  const patients = useStore((s) => s.patients);
  const createOrder = useStore((s) => s.createOrder);
  const processOrder = useStore((s) => s.processOrder);
  const { warehouses: doctorWarehouses } = useWarehouse();

  const [form, setForm] = useState(EMPTY_FORM);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [confirmAcceptOrderId, setConfirmAcceptOrderId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [returnReceivedOrderId, setReturnReceivedOrderId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [incorrectOutcome, setIncorrectOutcome] = useState<"devolver_stock" | "descartar">("devolver_stock");
  const [incorrectMedicationId, setIncorrectMedicationId] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);

  const requestWarehouses = doctorWarehouses.filter((w) => w.workspaceId === session?.workspaceId);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(requestWarehouses[0]?.id ?? "");
  const internaWarehouse = requestWarehouses.find((w) => w.id === selectedWarehouseId) ?? requestWarehouses[0] ?? null;

  const availableStock =
    form.medicationId && internaWarehouse
      ? stockFor(batches, form.medicationId, internaWarehouse.id)
      : 0;
  const availableLots = batches
    .filter(
      (b) =>
        b.medicationId === form.medicationId &&
        b.warehouseId === (internaWarehouse?.id ?? "") &&
        b.quantity > 0,
    )
    .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  const defaultLot = availableLots[0] ?? null;
  const selectedLot =
    availableLots.find((b) => b.id === form.sourceBatchId) ??
    defaultLot ??
    null;
  const lotChangedFromNearest =
    !!selectedLot && !!defaultLot && selectedLot.id !== defaultLot.id;

  const myOrders = orders.filter(
    (o) => o.doctor === session?.name && o.warehouseId === internaWarehouse?.id,
  );
  const pending = myOrders.filter((o) => o.status === "pendiente").length;
  const approved = myOrders.filter((o) => o.status === "aprobado").length;
  const dispensed = myOrders.filter((o) => o.status === "despachado").length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creatingOrder) return;
    if (!form.medicationId || !form.patient.trim() || !form.room.trim() || !form.reason.trim()) {
      toast.error("Completá todos los campos obligatorios.");
      return;
    }
    if (!internaWarehouse) {
      toast.error("No se encontró la Farmacia Interna del hospital.");
      return;
    }
    if (form.quantity < 1) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }
    if (!selectedLot) {
      toast.error("Seleccioná un lote con stock para este medicamento.");
      return;
    }
    if (form.quantity > selectedLot.quantity) {
      toast.error("La cantidad excede el stock del lote seleccionado.");
      return;
    }
    try {
      setCreatingOrder(true);
      await createOrder({
        medicationId: form.medicationId,
        sourceBatchId: selectedLot.id,
        warehouseId: internaWarehouse.id,
        quantity: form.quantity,
        patient: form.patient.trim(),
        room: form.room.trim(),
        reason: form.reason.trim(),
      });
      toast.success("Solicitud enviada a Farmacia Interna", {
        description: `${medName(form.medicationId)} — ${form.patient}`,
      });
      setForm(EMPTY_FORM);
      setOpenCreate(false);
    } finally {
      setCreatingOrder(false);
    }
  }

  async function requestReturn() {
    if (!returnOrderId) return;
    await processOrder(returnOrderId, "solicitar_devolucion");
    toast.success("Devolución solicitada", {
      description: "Se notificó a Farmacia para validar estado de caja.",
    });
    setReturnOrderId(null);
  }

  async function acceptDispatched() {
    if (!confirmAcceptOrderId) return;
    await processOrder(confirmAcceptOrderId, "confirmar_recepcion");
    toast.success("Pedido aceptado");
    setConfirmAcceptOrderId(null);
  }

  async function rejectDispatched() {
    if (!rejectOrderId) return;
    if (!rejectReason) {
      toast.error("Indicá una razón de rechazo.");
      return;
    }
    if (rejectReason === "Medicamento incorrecto") {
      if (!incorrectMedicationId) {
        toast.error("Seleccioná qué medicamento llegó realmente.");
        return;
      }
      await processOrder(
        rejectOrderId,
        "solicitar_devolucion",
        `Medicamento incorrecto · Recibido: ${medName(incorrectMedicationId)} · Resolución propuesta: ${incorrectOutcome === "devolver_stock" ? "Devolver a stock" : "Descartar"}`,
      );
    } else if (rejectReason === "Sin uso") {
      await processOrder(rejectOrderId, "aprobar_devolucion", "Sin uso");
    } else {
      await processOrder(rejectOrderId, "rechazar_devolucion", rejectReason);
    }
    toast.success("Rechazo procesado");
    setRejectOrderId(null);
    setRejectReason("");
    setIncorrectOutcome("devolver_stock");
    setIncorrectMedicationId("");
  }

  async function administrate(orderId: string) {
    await processOrder(orderId, "administrar");
    toast.success("Pedido marcado como administrado");
  }

  async function returnReceived(sealed: boolean) {
    if (!returnReceivedOrderId) return;
    if (sealed) {
      await processOrder(returnReceivedOrderId, "devolver_recibido");
      toast.success("Medicamento devuelto al inventario");
    } else {
      await processOrder(returnReceivedOrderId, "descartar_recibido", "No sellado en caja");
      toast.success("Medicamento descartado");
    }
    setReturnReceivedOrderId(null);
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold">Pedidos médicos</h1>
            <p className="text-sm text-muted-foreground">
              Solicitudes hacia{" "}
              <span className="font-medium text-foreground">
                {internaWarehouse?.name ?? "Farmacia Interna"}
              </span>
            </p>
          </div>
          <Button onClick={() => setOpenCreate(true)} className="w-full sm:w-auto">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo pedido
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{approved}</p>
              <p className="text-xs text-muted-foreground">Aprobados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PackageCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{dispensed}</p>
              <p className="text-xs text-muted-foreground">Despachados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mis solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay solicitudes registradas aún.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="hidden md:table-cell">Paciente</TableHead>
                  <TableHead className="hidden lg:table-cell">Sala</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{medName(o.medicationId)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{o.patient}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{o.room}</TableCell>
                    <TableCell className="text-right">{o.quantity}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground text-xs md:table-cell">
                      {formatDate(o.requestedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.status === "despachado" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setConfirmAcceptOrderId(o.id)}>
                            Aceptar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectOrderId(o.id)}>
                            Rechazar
                          </Button>
                        </div>
                      )}
                      {o.status === "recibido" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => administrate(o.id)}>
                            Administrado
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setReturnReceivedOrderId(o.id)}>
                            Devolver
                          </Button>
                        </div>
                      )}
                      {o.status === "administrado" && (
                        <span className="text-xs text-muted-foreground">Finalizado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo pedido</DialogTitle>
            <DialogDescription>
              Registrá una nueva solicitud de medicación.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Medicamento</Label>
              <Select
                value={form.medicationId}
                onValueChange={(v) => setForm((f) => ({ ...f, medicationId: v, sourceBatchId: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un medicamento" />
                </SelectTrigger>
                <SelectContent>
                  {medications.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.concentrationValue}{m.concentrationUnit} — {m.form}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.medicationId && (
                <p className="text-xs text-muted-foreground">
                  Stock en farmacia interna:{" "}
                  <span className={availableStock === 0 ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
                    {availableStock} u.
                  </span>
                </p>
              )}
              {form.medicationId && availableStock === 0 && (
                <p className="text-xs text-amber-700">
                  Si no ves stock, es porque el depósito al que tienes acceso no tiene más stock, si es así solicita más stock al jefe del depósito.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Depósito</Label>
              <Select
                value={internaWarehouse?.id ?? ""}
                onValueChange={(value) => {
                  setSelectedWarehouseId(value);
                  setForm((f) => ({ ...f, sourceBatchId: "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná depósito..." /></SelectTrigger>
                <SelectContent>
                  {requestWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lote de salida</Label>
              <Select
                value={selectedLot?.id ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, sourceBatchId: v }))}
                disabled={!form.medicationId || availableLots.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná un lote" /></SelectTrigger>
                <SelectContent>
                  {availableLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vencimiento del lote</Label>
                  <Input value={selectedLot ? formatDate(selectedLot.expiry) : "—"} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stock disponible del lote</Label>
                  <Input value={selectedLot ? `${selectedLot.quantity} u` : "—"} disabled />
                </div>
              </div>
              {lotChangedFromNearest && (
                <p className="text-xs text-amber-700">
                  Verificá que el lote elegido sea el más próximo a vencer.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Input
                list="patients-suggestions"
                placeholder="Buscar paciente por coincidencia..."
                value={form.patient}
                onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
              />
              <datalist id="patients-suggestions">
                {patients.map((p) => (
                  <option key={p.id} value={`${p.lastName}, ${p.firstName}`} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Habitación / Sala</Label>
              <Input
                placeholder="Ej: Sala 7, UCI, Guardia"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Indicación clínica</Label>
              <Textarea
                placeholder="Motivo del pedido, diagnóstico, tratamiento..."
                value={form.reason}
                rows={3}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={creatingOrder}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creatingOrder}
                className={creatingOrder ? "bg-muted text-muted-foreground hover:bg-muted" : undefined}
              >
                {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar pedido"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!returnOrderId} onOpenChange={(o) => !o && setReturnOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar devolución</DialogTitle>
            <DialogDescription>
              El medicamento debe estar sellado en su caja para que la devolución sea admitida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOrderId(null)}>Cancelar</Button>
            <Button onClick={requestReturn}>Confirmar solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmAcceptOrderId} onOpenChange={(o) => !o && setConfirmAcceptOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceptar pedido despachado</DialogTitle>
            <DialogDescription>
              Confirmás que el pedido fue recibido correctamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAcceptOrderId(null)}>Cancelar</Button>
            <Button onClick={acceptDispatched}>Confirmar aceptación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!rejectOrderId} onOpenChange={(o) => !o && setRejectOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar pedido despachado</DialogTitle>
            <DialogDescription>
              Indicá la razón del rechazo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Razón</Label>
            <Select value={rejectReason} onValueChange={setRejectReason}>
              <SelectTrigger><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Medicamento incorrecto">Medicamento incorrecto</SelectItem>
                <SelectItem value="Sin uso">Sin uso</SelectItem>
                <SelectItem value="Caja dañada">Caja dañada</SelectItem>
                <SelectItem value="Caja abierta">Caja abierta</SelectItem>
                <SelectItem value="Descarte">Descarte</SelectItem>
              </SelectContent>
            </Select>
            {rejectReason === "Medicamento incorrecto" && (
              <div className="space-y-2">
                <Label>Medicamento recibido realmente</Label>
                <Select value={incorrectMedicationId} onValueChange={setIncorrectMedicationId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar medicamento..." /></SelectTrigger>
                  <SelectContent>
                    {medications.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.concentrationValue}{m.concentrationUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Resolución de stock</Label>
                <Select value={incorrectOutcome} onValueChange={(v) => setIncorrectOutcome(v as "devolver_stock" | "descartar")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devolver_stock">Devolver a stock</SelectItem>
                    <SelectItem value="descartar">Descartar medicamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOrderId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={rejectDispatched}>Confirmar rechazo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!returnReceivedOrderId} onOpenChange={(o) => !o && setReturnReceivedOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver medicamento recibido</DialogTitle>
            <DialogDescription>
              ¿El medicamento sigue en su caja sellada?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={() => returnReceived(false)}>
              No, descartar
            </Button>
            <Button onClick={() => returnReceived(true)}>
              Sí, devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminView() {
  const orders = useStore((s) => s.orders);
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const patients = useStore((s) => s.patients);
  const users = useStore((s) => s.users);
  const session = useStore((s) => s.session);
  const processOrder = useStore((s) => s.processOrder);
  const createOrder = useStore((s) => s.createOrder);

  const storeWarehouses = useStore((s) => s.warehouses);
  const allWarehouses = storeWarehouses;
  const internaWarehouseIds = new Set(
    allWarehouses
      .filter((w) => (w.type === "interna" || w.type === "central") && w.workspaceId === session?.workspaceId)
      .map((w) => w.id)
  );

  const workspaceOrders = orders
    .filter((o) => internaWarehouseIds.has(o.warehouseId))
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  const requestWarehouses = allWarehouses.filter(
    (w) => (w.type === "interna" || w.type === "central") && w.workspaceId === session?.workspaceId,
  );
  const doctors = users.filter((u) => u.workspaceId === session?.workspaceId && u.role === "doctor");

  const pending = workspaceOrders.filter((o) => o.status === "pendiente").length;
  const approved = workspaceOrders.filter((o) => o.status === "aprobado").length;
  const dispensed = workspaceOrders.filter((o) => o.status === "despachado").length;
  const [openCreate, setOpenCreate] = useState(false);
  const [newOrder, setNewOrder] = useState({
    doctorName: doctors[0]?.name ?? "",
    warehouseId: requestWarehouses[0]?.id ?? "",
    medicationId: "",
    sourceBatchId: "",
    patient: "",
    room: "",
    quantity: 1,
    reason: "",
  });
  const [confirmAction, setConfirmAction] = useState<null | {
    orderId: string;
    action:
      | "aprobar"
      | "despachar"
      | "marcar_recibir"
      | "confirmar_recepcion"
      | "administrar"
      | "rechazar"
      | "aprobar_devolucion"
      | "rechazar_devolucion";
    title: string;
    description: string;
  }>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [creatingAssistedOrder, setCreatingAssistedOrder] = useState(false);
  const availableLots = batches
    .filter(
      (b) =>
        b.medicationId === newOrder.medicationId &&
        b.warehouseId === newOrder.warehouseId &&
        b.quantity > 0,
    )
    .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry));
  const defaultLot = availableLots[0] ?? null;
  const selectedLot = availableLots.find((b) => b.id === newOrder.sourceBatchId) ?? defaultLot ?? null;
  const lotChangedFromNearest = !!selectedLot && !!defaultLot && selectedLot.id !== defaultLot.id;

  async function handle() {
    if (!confirmAction) return;
    if (confirmAction.action === "rechazar_devolucion" && !rejectReason) {
      toast.error("Seleccioná razón de rechazo.");
      return;
    }
    await processOrder(confirmAction.orderId, confirmAction.action, rejectReason || undefined);
    toast.success("Estado de pedido actualizado");
    setConfirmAction(null);
    setRejectReason("");
  }

  async function createAssistedOrder(e: React.FormEvent) {
    e.preventDefault();
    if (creatingAssistedOrder) return;
    if (!newOrder.doctorName || !newOrder.warehouseId || !newOrder.medicationId) {
      toast.error("Completá médico, depósito y medicamento.");
      return;
    }
    if (!newOrder.patient.trim() || !newOrder.room.trim() || !newOrder.reason.trim()) {
      toast.error("Completá paciente, sala e indicación clínica.");
      return;
    }
    if (newOrder.quantity < 1) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }
    if (!selectedLot) {
      toast.error("Seleccioná un lote con stock disponible.");
      return;
    }
    if (newOrder.quantity > selectedLot.quantity) {
      toast.error("La cantidad supera el stock del lote seleccionado.");
      return;
    }
    try {
      setCreatingAssistedOrder(true);
      await createOrder({
        medicationId: newOrder.medicationId,
        sourceBatchId: selectedLot.id,
        warehouseId: newOrder.warehouseId,
        quantity: newOrder.quantity,
        doctorName: newOrder.doctorName,
        patient: newOrder.patient.trim(),
        room: newOrder.room.trim(),
        reason: newOrder.reason.trim(),
      });
      toast.success("Pedido médico cargado por administración");
      setOpenCreate(false);
      setNewOrder({
        doctorName: doctors[0]?.name ?? "",
        warehouseId: requestWarehouses[0]?.id ?? "",
        medicationId: "",
        sourceBatchId: "",
        patient: "",
        room: "",
        quantity: 1,
        reason: "",
      });
    } finally {
      setCreatingAssistedOrder(false);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold">Pedidos médicos</h1>
            <p className="text-sm text-muted-foreground">
              Solicitudes recibidas en Farmacia Interna
            </p>
          </div>
          <Button onClick={() => setOpenCreate(true)} className="w-full sm:w-auto">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo pedido asistido
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{approved}</p>
              <p className="text-xs text-muted-foreground">Aprobados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <PackageCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{dispensed}</p>
              <p className="text-xs text-muted-foreground">Dispensados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Todos los pedidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {workspaceOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay pedidos registrados aún.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Médico</TableHead>
                  <TableHead className="hidden lg:table-cell">Paciente</TableHead>
                  <TableHead className="hidden lg:table-cell">Sala</TableHead>
                  <TableHead className="hidden md:table-cell">Depósito</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Stock disp.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceOrders.map((o) => {
                  const stock = stockFor(batches, o.medicationId, o.warehouseId);
                  const canDispatch = o.status === "aprobado" && stock >= o.quantity;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="hidden font-medium md:table-cell">{o.doctor}</TableCell>
                      <TableCell className="hidden lg:table-cell">{o.patient}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{o.room}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{warehouseName(o.warehouseId)}</TableCell>
                      <TableCell>{medName(o.medicationId)}</TableCell>
                      <TableCell className="text-right">{o.quantity}</TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <span
                          className={
                            stock < o.quantity
                              ? "font-semibold text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {stock}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDate(o.requestedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {o.status === "pendiente" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setConfirmAction({
                                  orderId: o.id,
                                  action: "aprobar",
                                  title: "Aprobar pedido",
                                  description: "Confirmá que el pedido es válido para continuar el flujo.",
                                })}
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setConfirmAction({
                                  orderId: o.id,
                                  action: "rechazar",
                                  title: "Rechazar pedido",
                                  description: "Confirmá rechazo de este pedido.",
                                })}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Rechazar
                              </Button>
                            </>
                          )}
                          {o.status === "aprobado" && (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={!canDispatch}
                              onClick={() => setConfirmAction({
                                orderId: o.id,
                                action: "despachar",
                                title: "Despachar pedido",
                                description: `Vas a descontar ${o.quantity}u del stock del depósito.`,
                              })}
                              title={!canDispatch ? "Stock insuficiente en Farmacia Interna" : undefined}
                            >
                              <Truck className="mr-1 h-3.5 w-3.5" />
                              Despachar
                            </Button>
                          )}
                          {o.status === "despachado" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmAction({
                                orderId: o.id,
                                action: "marcar_recibir",
                                title: "Pasar a recibir",
                                description: "Se marca el pedido listo para recepción clínica.",
                              })}
                            >
                              Marcar recibir
                            </Button>
                          )}
                          {o.status === "recibir" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmAction({
                                orderId: o.id,
                                action: "confirmar_recepcion",
                                title: "Confirmar recepción",
                                description: "Confirmás que el medicamento fue recibido por el área clínica.",
                              })}
                            >
                              Confirmar recepción
                            </Button>
                          )}
                          {o.status === "recibido" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmAction({
                                orderId: o.id,
                                action: "administrar",
                                title: "Marcar administrado",
                                description: "Se registrará como medicamento administrado al paciente.",
                              })}
                            >
                              Administrado
                            </Button>
                          )}
                          {o.status === "devolucion_solicitada" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmAction({
                                  orderId: o.id,
                                  action: "aprobar_devolucion",
                                  title: "Aprobar devolución",
                                  description: "Usted avala que el medicamento sigue sellado en su caja.",
                                })}
                              >
                                Aprobar devolución
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setConfirmAction({
                                  orderId: o.id,
                                  action: "rechazar_devolucion",
                                  title: "Rechazar devolución",
                                  description: "Indique razón de rechazo.",
                                })}
                              >
                                Rechazar devolución
                              </Button>
                            </div>
                          )}
                          {(o.status === "devuelto" || o.status === "devolucion_rechazada" || o.status === "rechazado") && (
                            <span className="text-xs text-muted-foreground">
                              {o.processedBy}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>
          {confirmAction?.action === "rechazar_devolucion" && (
            <div className="space-y-2">
              <Label>Indique razón de rechazo</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Caja dañada">Caja dañada</SelectItem>
                  <SelectItem value="Caja abierta">Caja abierta</SelectItem>
                  <SelectItem value="Descarte">Descarte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              variant={confirmAction?.action?.includes("rechazar") ? "destructive" : "default"}
              onClick={handle}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo pedido médico (carga asistida)</DialogTitle>
            <DialogDescription>
              Registrá un pedido en nombre del médico. La auditoría dejará trazado que lo cargó un admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAssistedOrder} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Médico solicitante</Label>
              <Select
                value={newOrder.doctorName}
                onValueChange={(value) => setNewOrder((s) => ({ ...s, doctorName: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná médico..." /></SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.name}>{doctor.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Depósito</Label>
              <Select
                value={newOrder.warehouseId}
                onValueChange={(value) => setNewOrder((s) => ({ ...s, warehouseId: value, sourceBatchId: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná depósito..." /></SelectTrigger>
                <SelectContent>
                  {requestWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Medicamento</Label>
              <Select
                value={newOrder.medicationId}
                onValueChange={(value) => setNewOrder((s) => ({ ...s, medicationId: value, sourceBatchId: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná medicamento..." /></SelectTrigger>
                <SelectContent>
                  {medications.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.concentrationValue}{m.concentrationUnit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newOrder.medicationId && (
                <p className="text-xs text-muted-foreground">
                  Stock en depósito seleccionado:{" "}
                  <span
                    className={
                      stockFor(batches, newOrder.medicationId, newOrder.warehouseId) === 0
                        ? "font-semibold text-destructive"
                        : "font-semibold text-foreground"
                    }
                  >
                    {stockFor(batches, newOrder.medicationId, newOrder.warehouseId)} u.
                  </span>
                </p>
              )}
              {newOrder.medicationId && stockFor(batches, newOrder.medicationId, newOrder.warehouseId) === 0 && (
                <p className="text-xs text-amber-700">
                  Si no ves stock, es porque el depósito al que tienes acceso no tiene más stock, si es así solicita más stock al jefe del depósito.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Lote de salida</Label>
              <Select
                value={selectedLot?.id ?? ""}
                onValueChange={(value) => setNewOrder((s) => ({ ...s, sourceBatchId: value }))}
                disabled={!newOrder.medicationId || !newOrder.warehouseId || availableLots.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="Seleccioná lote..." /></SelectTrigger>
                <SelectContent>
                  {availableLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vencimiento del lote</Label>
                  <Input value={selectedLot ? formatDate(selectedLot.expiry) : "—"} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stock disponible del lote</Label>
                  <Input value={selectedLot ? `${selectedLot.quantity} u` : "—"} disabled />
                </div>
              </div>
              {lotChangedFromNearest && (
                <p className="text-xs text-amber-700">
                  Verificá que el lote seleccionado sea el más próximo a vencer.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Input
                list="patients-suggestions-admin"
                value={newOrder.patient}
                onChange={(e) => setNewOrder((s) => ({ ...s, patient: e.target.value }))}
                placeholder="Buscar paciente por coincidencia..."
              />
              <datalist id="patients-suggestions-admin">
                {patients.map((p) => (
                  <option key={p.id} value={`${p.lastName}, ${p.firstName}`} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Sala / Habitación</Label>
              <Input
                value={newOrder.room}
                onChange={(e) => setNewOrder((s) => ({ ...s, room: e.target.value }))}
                placeholder="Ej: Sala 7"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={newOrder.quantity}
                onChange={(e) => setNewOrder((s) => ({ ...s, quantity: Math.max(1, Number(e.target.value)) }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Indicación clínica</Label>
              <Textarea
                rows={3}
                value={newOrder.reason}
                onChange={(e) => setNewOrder((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Motivo del pedido, diagnóstico, tratamiento..."
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={creatingAssistedOrder}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creatingAssistedOrder}
                className={creatingAssistedOrder ? "bg-muted text-muted-foreground hover:bg-muted" : undefined}
              >
                {creatingAssistedOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar pedido"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PedidosPage() {
  const session = useStore((s) => s.session);
  return session?.role === "doctor" ? <DoctorView /> : <AdminView />;
}

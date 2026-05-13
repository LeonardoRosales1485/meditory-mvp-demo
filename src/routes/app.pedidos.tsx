import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  formatDate,
  medName,
  warehouseName,
  WING_TYPE_LABEL,
  type Patient,
  type Room,
  type Wing,
} from "@/lib/domain-types";
import { requireAuth } from "@/lib/route-guards";
import { useWarehouse } from "@/lib/warehouse-context";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

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

const EMPTY_FORM = {
  medicationId: "",
  sourceBatchId: "",
  patient: "",
  room: "",
  quantity: 1,
  reason: "",
  wingId: "",
  roomId: "",
  bedId: "",
  /** Paciente elegido desde «Pacientes internados»; permite habilitar la cama ocupada aunque aún no resuelva `bed.patientId` en el picker. */
  internedPatientId: "",
};

function patientOrderLabel(p: Patient) {
  return `${p.lastName}, ${p.firstName}`;
}

/** Lista de pacientes con cama asignada en el workspace (internados). */
function patientsInternedInRooms(patients: Patient[], workspaceRooms: Room[]): Patient[] {
  const ids = new Set<string>();
  for (const r of workspaceRooms) {
    for (const b of r.beds) {
      if (b.patientId) ids.add(b.patientId);
    }
  }
  return patients.filter((p) => ids.has(p.id));
}

/** Mapa paciente → ubicación de su cama actual. */
function patientBedPlacementMap(workspaceRooms: Room[]) {
  const m = new Map<string, { wingId: string; roomId: string; bedId: string; fullNumber: number }>();
  for (const r of workspaceRooms) {
    for (const b of r.beds) {
      if (b.patientId) {
        m.set(b.patientId, {
          wingId: r.wingId,
          roomId: r.id,
          bedId: b.id,
          fullNumber: r.fullNumber,
        });
      }
    }
  }
  return m;
}

/** Autocompletado solo para pacientes internados; al elegir uno rellena ala/sala/cama en el padre. */
function InternedPatientOrderField({
  value,
  onChangeText,
  onPickPatient,
  patientsInterned,
  placementByPatientId,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onPickPatient: (p: Patient) => void;
  patientsInterned: Patient[];
  placementByPatientId: Map<string, { wingId: string; roomId: string; bedId: string; fullNumber: number }>;
  placeholder: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateMenuPos = useCallback(() => {
    const input = wrapRef.current?.querySelector("input");
    if (!input) return;
    const r = input.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [...patientsInterned].slice(0, 12);
    return patientsInterned
      .filter((p) => {
        const full = patientOrderLabel(p).toLowerCase();
        return full.includes(q) || p.firstName.toLowerCase().includes(q) || p.lastName.toLowerCase().includes(q);
      })
      .slice(0, 25);
  }, [patientsInterned, value]);

  useLayoutEffect(() => {
    if (!open || patientsInterned.length === 0) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    window.addEventListener("scroll", updateMenuPos, true);
    window.addEventListener("resize", updateMenuPos);
    return () => {
      window.removeEventListener("scroll", updateMenuPos, true);
      window.removeEventListener("resize", updateMenuPos);
    };
  }, [open, patientsInterned.length, updateMenuPos, filtered.length, value]);

  const list =
    open && patientsInterned.length > 0 && menuPos ? (
      <ul
        className="pointer-events-auto max-h-52 overflow-auto rounded-md border border-border bg-background shadow-md"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 10_050,
        }}
        role="listbox"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>
        ) : (
          filtered.map((p) => (
            <li key={p.id} className="border-b border-border last:border-0">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!placementByPatientId.has(p.id)) return;
                  onPickPatient(p);
                  setOpen(false);
                }}
              >
                {patientOrderLabel(p)}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          queueMicrotask(updateMenuPos);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </div>
  );
}

const NONE_VALUE = "__none__";

/** Selector en cascada Ala → Sala → Cama para pedidos.
 *  Salas sin camas libres quedan deshabilitadas salvo que incluyan la cama del paciente vinculado (`linkedPatientId`).
 *  Camas libres o la cama ocupada por ese paciente son seleccionables. */
function InternmentPickerForOrder({
  wings,
  rooms,
  patients,
  wingId,
  roomId,
  bedId,
  linkedPatientId,
  onChange,
  disabled,
}: {
  wings: Wing[];
  rooms: Room[];
  patients: Patient[];
  wingId: string;
  roomId: string;
  bedId: string;
  linkedPatientId?: string;
  onChange: (next: { wingId: string; roomId: string; bedId: string; patientName: string; room: string }) => void;
  disabled?: boolean;
}) {
  const sortedWings = useMemo(() => [...wings].sort((a, b) => a.prefix - b.prefix), [wings]);
  const filteredRooms = useMemo(
    () => rooms.filter((r) => r.wingId === wingId).sort((a, b) => a.fullNumber - b.fullNumber),
    [rooms, wingId],
  );
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;
  const patientNameById = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.lastName}, ${p.firstName}`));
    return m;
  }, [patients]);

  const isBedSelectable = (b: { patientId: string | null }) =>
    !b.patientId || (!!linkedPatientId && b.patientId === linkedPatientId);
  const roomHasSelectableBed = (r: Room) => r.beds.some((b) => isBedSelectable(b));

  function handleWingChange(v: string) {
    const next = v === NONE_VALUE ? "" : v;
    if (next === wingId) return;
    onChange({ wingId: next, roomId: "", bedId: "", patientName: "", room: "" });
  }

  function handleRoomChange(v: string) {
    const next = v === NONE_VALUE ? "" : v;
    if (next === roomId) return;
    const r = rooms.find((x) => x.id === next);
    onChange({
      wingId,
      roomId: next,
      bedId: "",
      patientName: "",
      room: r ? String(r.fullNumber) : "",
    });
  }

  function handleBedChange(v: string) {
    const next = v === NONE_VALUE ? "" : v;
    if (next === bedId) return;
    const bed = selectedRoom?.beds.find((b) => b.id === next) ?? null;
    const patientName = bed?.patientId ? patientNameById.get(bed.patientId) ?? "" : "";
    onChange({
      wingId,
      roomId,
      bedId: next,
      patientName,
      room: selectedRoom ? String(selectedRoom.fullNumber) : "",
    });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Internación</p>
        <span className="text-[11px] text-muted-foreground">
          Salas sin camas libres quedan deshabilitadas (salvo la del paciente elegido en Pacientes internados).
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Ala</Label>
          <Select
            value={wingId || NONE_VALUE}
            disabled={disabled || sortedWings.length === 0}
            onValueChange={handleWingChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={sortedWings.length === 0 ? "Sin alas" : "Sin asignar"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sin asignar</SelectItem>
              {sortedWings.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} · {w.prefix}xx ({WING_TYPE_LABEL[w.type]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sala</Label>
          <Select
            value={roomId || NONE_VALUE}
            disabled={disabled || !wingId || filteredRooms.length === 0}
            onValueChange={handleRoomChange}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !wingId
                    ? "Elegí un ala primero"
                    : filteredRooms.length === 0
                    ? "Sin salas"
                    : "Sin sala"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sin sala</SelectItem>
              {filteredRooms.map((r) => {
                const free = r.beds.filter((b) => !b.patientId).length;
                const available = roomHasSelectableBed(r);
                return (
                  <SelectItem key={r.id} value={r.id} disabled={!available}>
                    <span className={!available ? "opacity-50" : undefined}>
                      Sala {r.fullNumber} · {free}/{r.bedCount} libre{free === 1 ? "" : "s"}
                      {!available ? " · sin camas libres" : ""}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cama</Label>
          <Select
            value={bedId || NONE_VALUE}
            disabled={disabled || !roomId}
            onValueChange={handleBedChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={!roomId ? "Elegí una sala primero" : "Sin cama"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sin cama</SelectItem>
              {selectedRoom?.beds.map((b) => {
                const available = isBedSelectable(b);
                const occupantName = b.patientId ? patientNameById.get(b.patientId) : null;
                return (
                  <SelectItem key={b.id} value={b.id} disabled={!available}>
                    <span className={!available ? "opacity-50" : undefined}>
                      Cama {b.position}
                      {occupantName ? ` · ${occupantName}` : " · libre"}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function DoctorView() {
  const session = useStore((s) => s.session);
  const medications = useStore((s) => s.medications);
  const catalogMedications = useMemo(() => medications.filter((m) => !m.deletedAt), [medications]);
  const batches = useStore((s) => s.batches);
  const orders = useStore((s) => s.orders);
  const patients = useStore((s) => s.patients);
  const wings = useStore((s) => s.wings);
  const rooms = useStore((s) => s.rooms);
  const createOrder = useStore((s) => s.createOrder);
  const processOrder = useStore((s) => s.processOrder);
  const { warehouses: doctorWarehouses } = useWarehouse();
  const workspaceWings = useMemo(
    () => wings.filter((w) => w.workspaceId === session?.workspaceId),
    [wings, session?.workspaceId],
  );
  const workspaceRooms = useMemo(
    () => rooms.filter((r) => r.workspaceId === session?.workspaceId),
    [rooms, session?.workspaceId],
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const patientPlacement = useMemo(() => patientBedPlacementMap(workspaceRooms), [workspaceRooms]);
  const internedPatients = useMemo(
    () => patientsInternedInRooms(patients, workspaceRooms),
    [patients, workspaceRooms],
  );
  const linkedPatientIdForPicker = useMemo(() => {
    const r = workspaceRooms.find((x) => x.id === form.roomId);
    const b = r?.beds.find((x) => x.id === form.bedId);
    return b?.patientId ?? (form.internedPatientId ? form.internedPatientId : undefined);
  }, [form.roomId, form.bedId, form.internedPatientId, workspaceRooms]);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [confirmAcceptOrderId, setConfirmAcceptOrderId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [returnReceivedOrderId, setReturnReceivedOrderId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [incorrectOutcome, setIncorrectOutcome] = useState<"devolver_stock" | "descartar">("devolver_stock");
  const [incorrectMedicationId, setIncorrectMedicationId] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-pedidos-doctor");

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
      toast.error("Completá medicamento, paciente, internación (ala y sala) e indicación.");
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
          {isMobile && (
            <div className="px-3 pb-3">
              <MobileViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
          {myOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay solicitudes registradas aún.
            </p>
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 p-3">
              {myOrders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{medName(o.medicationId)}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Paciente: {o.patient}</p>
                      <p>Sala: {o.room}</p>
                      <p>Cantidad: <span className="font-semibold text-foreground">{o.quantity} u</span></p>
                      <p>Fecha: {formatDate(o.requestedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.status === "despachado" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setConfirmAcceptOrderId(o.id)}>
                            Aceptar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectOrderId(o.id)}>
                            Rechazar
                          </Button>
                        </>
                      )}
                      {o.status === "recibido" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => administrate(o.id)}>
                            Administrado
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setReturnReceivedOrderId(o.id)}>
                            Devolver
                          </Button>
                        </>
                      )}
                      {o.status === "administrado" && (
                        <span className="text-xs text-muted-foreground">Finalizado</span>
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
                  {catalogMedications.map((m) => (
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
            <div className="space-y-1.5 md:col-span-2">
              <Label>Pacientes internados</Label>
              <InternedPatientOrderField
                value={form.patient}
                onChangeText={(v) =>
                  setForm((f) => ({
                    ...f,
                    patient: v,
                    ...(v.trim() === ""
                      ? { wingId: "", roomId: "", bedId: "", room: "", internedPatientId: "" }
                      : {}),
                  }))
                }
                onPickPatient={(p) => {
                  const pl = patientPlacement.get(p.id);
                  if (!pl) return;
                  setForm((f) => ({
                    ...f,
                    patient: patientOrderLabel(p),
                    wingId: pl.wingId,
                    roomId: pl.roomId,
                    bedId: pl.bedId,
                    room: String(pl.fullNumber),
                    internedPatientId: p.id,
                  }));
                }}
                patientsInterned={internedPatients}
                placementByPatientId={patientPlacement}
                placeholder="Buscar internado por apellido o nombre…"
              />
              <p className="text-[11px] text-muted-foreground">
                Solo aparecen pacientes con cama asignada. Al elegir uno se completan ala, sala y cama.
              </p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <InternmentPickerForOrder
                wings={workspaceWings}
                rooms={workspaceRooms}
                patients={patients}
                wingId={form.wingId}
                roomId={form.roomId}
                bedId={form.bedId}
                linkedPatientId={linkedPatientIdForPicker}
                onChange={({ wingId, roomId, bedId, patientName, room }) =>
                  setForm((f) => ({
                    ...f,
                    wingId,
                    roomId,
                    bedId,
                    patient: patientName,
                    room,
                    internedPatientId: patientName === "" ? "" : f.internedPatientId,
                  }))
                }
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
                    {catalogMedications.map((m) => (
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
  const catalogMedications = useMemo(() => medications.filter((m) => !m.deletedAt), [medications]);
  const patients = useStore((s) => s.patients);
  const users = useStore((s) => s.users);
  const userWarehouseAccesses = useStore((s) => s.userWarehouseAccesses);
  const wings = useStore((s) => s.wings);
  const rooms = useStore((s) => s.rooms);
  const session = useStore((s) => s.session);
  const processOrder = useStore((s) => s.processOrder);
  const createOrder = useStore((s) => s.createOrder);
  const workspaceWings = useMemo(
    () => wings.filter((w) => w.workspaceId === session?.workspaceId),
    [wings, session?.workspaceId],
  );
  const workspaceRooms = useMemo(
    () => rooms.filter((r) => r.workspaceId === session?.workspaceId),
    [rooms, session?.workspaceId],
  );

  const storeWarehouses = useStore((s) => s.warehouses);
  const allWarehouses = storeWarehouses;
  const internaWarehouseIds = new Set(
    allWarehouses
      .filter(
        (w) =>
          (w.type === "interna" || w.type === "central") &&
          w.workspaceId === session?.workspaceId &&
          !w.deletedAt,
      )
      .map((w) => w.id),
  );

  const meUser =
    users.find(
      (u) =>
        u.workspaceId === session?.workspaceId &&
        u.email.toLowerCase() === (session?.email ?? "").toLowerCase(),
    ) ?? users.find((u) => u.workspaceId === session?.workspaceId && u.name === session?.name);
  const myWarehouseIds = new Set(
    userWarehouseAccesses.filter((a) => a.userId === meUser?.id).map((a) => a.warehouseId),
  );
  const isTecnico = session?.role === "tecnico";

  const internaOrdersSorted = orders
    .filter((o) => internaWarehouseIds.has(o.warehouseId))
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  const workspaceOrders = isTecnico
    ? internaOrdersSorted.filter((o) => myWarehouseIds.has(o.warehouseId))
    : internaOrdersSorted;
  const requestWarehouses = allWarehouses.filter(
    (w) =>
      (w.type === "interna" || w.type === "central") &&
      w.workspaceId === session?.workspaceId &&
      !w.deletedAt,
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
    wingId: "",
    roomId: "",
    bedId: "",
    internedPatientId: "",
  });
  const patientPlacement = useMemo(() => patientBedPlacementMap(workspaceRooms), [workspaceRooms]);
  const internedPatients = useMemo(
    () => patientsInternedInRooms(patients, workspaceRooms),
    [patients, workspaceRooms],
  );
  const linkedPatientIdForPicker = useMemo(() => {
    const r = workspaceRooms.find((x) => x.id === newOrder.roomId);
    const b = r?.beds.find((x) => x.id === newOrder.bedId);
    return b?.patientId ?? (newOrder.internedPatientId ? newOrder.internedPatientId : undefined);
  }, [newOrder.roomId, newOrder.bedId, newOrder.internedPatientId, workspaceRooms]);

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
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-pedidos-admin");
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
      toast.error("Completá paciente, internación (ala y sala) e indicación clínica.");
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
        wingId: "",
        roomId: "",
        bedId: "",
        internedPatientId: "",
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
              {isTecnico
                ? "Pedidos en depósitos internos o centrales donde tenés acceso: podés despachar y registrar recepción."
                : "Solicitudes recibidas en Farmacia Interna"}
            </p>
          </div>
          {!isTecnico && (
            <Button onClick={() => setOpenCreate(true)} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" />
              Nuevo pedido asistido
            </Button>
          )}
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
              <p className="text-xs text-muted-foreground">Administrados</p>
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
          {isMobile && (
            <div className="px-3 pb-3">
              <MobileViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
          {workspaceOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isTecnico && myWarehouseIds.size === 0
                ? "No tenés depósitos asignados para gestionar pedidos médicos. Pedí acceso a un administrador."
                : "No hay pedidos registrados aún."}
            </p>
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 p-3">
              {workspaceOrders.map((o) => {
                const stock = stockFor(batches, o.medicationId, o.warehouseId);
                const canDispatch = o.status === "aprobado" && stock >= o.quantity;
                return (
                  <Card key={o.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{medName(o.medicationId)}</p>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Médico: {o.doctor}</p>
                        <p>Paciente: {o.patient}</p>
                        <p>Depósito: {warehouseName(o.warehouseId)}</p>
                        <p>Cantidad: <span className="font-semibold text-foreground">{o.quantity} u</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {o.status === "pendiente" && !isTecnico && (
                          <>
                            <Button size="sm" variant="default" onClick={() => setConfirmAction({ orderId: o.id, action: "aprobar", title: "Aprobar pedido", description: "Confirmá que el pedido es válido para continuar el flujo." })}>Aprobar</Button>
                            <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ orderId: o.id, action: "rechazar", title: "Rechazar pedido", description: "Confirmá rechazo de este pedido." })}>Rechazar</Button>
                          </>
                        )}
                        {o.status === "aprobado" && (
                          <Button size="sm" variant="default" disabled={!canDispatch} onClick={() => setConfirmAction({ orderId: o.id, action: "despachar", title: "Despachar pedido", description: `Vas a descontar ${o.quantity}u del stock del depósito.` })}>Despachar</Button>
                        )}
                        {o.status === "despachado" && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ orderId: o.id, action: "marcar_recibir", title: "Pasar a recibir", description: "Se marca el pedido listo para recepción clínica." })}>Marcar recibir</Button>
                        )}
                        {o.status === "recibir" && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ orderId: o.id, action: "confirmar_recepcion", title: "Confirmar recepción", description: "Confirmás que el medicamento fue recibido por el área clínica." })}>Confirmar recepción</Button>
                        )}
                        {o.status === "recibido" && !isTecnico && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ orderId: o.id, action: "administrar", title: "Marcar administrado", description: "Se registrará como medicamento administrado al paciente." })}>Administrado</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
                          {o.status === "pendiente" && !isTecnico && (
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
                          {o.status === "recibido" && !isTecnico && (
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
                          {o.status === "devolucion_solicitada" && !isTecnico && (
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
                  {catalogMedications.map((m) => (
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
            <div className="space-y-1.5 md:col-span-2">
              <Label>Pacientes internados</Label>
              <InternedPatientOrderField
                value={newOrder.patient}
                onChangeText={(v) =>
                  setNewOrder((s) => ({
                    ...s,
                    patient: v,
                    ...(v.trim() === ""
                      ? { wingId: "", roomId: "", bedId: "", room: "", internedPatientId: "" }
                      : {}),
                  }))
                }
                onPickPatient={(p) => {
                  const pl = patientPlacement.get(p.id);
                  if (!pl) return;
                  setNewOrder((s) => ({
                    ...s,
                    patient: patientOrderLabel(p),
                    wingId: pl.wingId,
                    roomId: pl.roomId,
                    bedId: pl.bedId,
                    room: String(pl.fullNumber),
                    internedPatientId: p.id,
                  }));
                }}
                patientsInterned={internedPatients}
                placementByPatientId={patientPlacement}
                placeholder="Buscar internado por apellido o nombre…"
              />
              <p className="text-[11px] text-muted-foreground">
                Solo aparecen pacientes con cama asignada. Al elegir uno se completan ala, sala y cama.
              </p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <InternmentPickerForOrder
                wings={workspaceWings}
                rooms={workspaceRooms}
                patients={patients}
                wingId={newOrder.wingId}
                roomId={newOrder.roomId}
                bedId={newOrder.bedId}
                linkedPatientId={linkedPatientIdForPicker}
                onChange={({ wingId, roomId, bedId, patientName, room }) =>
                  setNewOrder((s) => ({
                    ...s,
                    wingId,
                    roomId,
                    bedId,
                    patient: patientName,
                    room,
                    internedPatientId: patientName === "" ? "" : s.internedPatientId,
                  }))
                }
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

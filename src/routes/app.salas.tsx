import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, Building, Pencil, Plus, Search, Trash2, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { WING_TYPE_LABEL, type Patient, type Room, type Wing, type WingType } from "@/lib/domain-types";
import { requireAdminOrDoctor } from "@/lib/route-guards";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/salas")({
  beforeLoad: requireAdminOrDoctor,
  head: () => ({ meta: [{ title: "Meditory — Salas" }] }),
  component: SalasPage,
});

type WingForm = {
  name: string;
  type: WingType;
  prefix: number;
};

type RoomForm = {
  wingId: string;
  number: number;
  bedCount: number;
};

const EMPTY_WING: WingForm = { name: "", type: "hospitalizacion", prefix: 1 };
const EMPTY_ROOM: RoomForm = { wingId: "", number: 1, bedCount: 1 };

const WING_TYPE_BADGE: Record<WingType, string> = {
  urgencias: "text-red-700 border-red-300 bg-red-50",
  quirofanos: "text-sky-700 border-sky-300 bg-sky-50",
  cuidados_intensivos: "text-purple-700 border-purple-300 bg-purple-50",
  hospitalizacion: "text-emerald-700 border-emerald-300 bg-emerald-50",
  ambulatoria: "text-amber-700 border-amber-300 bg-amber-50",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildRoomSearchHaystack(room: Room, wing: Wing | undefined, patientById: Map<string, Patient>): string {
  const parts: string[] = [
    String(room.fullNumber),
    String(room.number),
    `sala ${room.fullNumber}`,
    (wing?.name ?? "").toLowerCase(),
    wing ? WING_TYPE_LABEL[wing.type].toLowerCase() : "",
  ];
  for (const b of room.beds) {
    parts.push(String(b.position));
    const p = b.patientId ? patientById.get(b.patientId) : undefined;
    if (p) {
      const fn = p.firstName.toLowerCase();
      const ln = p.lastName.toLowerCase();
      parts.push(fn, ln, `${ln}, ${fn}`);
    } else {
      parts.push("libre");
    }
  }
  return parts.join(" ").toLowerCase();
}

function roomMatchesQuery(
  room: Room,
  wingById: Map<string, Wing>,
  patientById: Map<string, Patient>,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return buildRoomSearchHaystack(room, wingById.get(room.wingId), patientById).includes(q);
}

function SalasPage() {
  const session = useStore((s) => s.session);
  const isAdmin = session?.role === "admin";
  const wings = useStore((s) => s.wings);
  const rooms = useStore((s) => s.rooms);
  const patients = useStore((s) => s.patients);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addWing = useStore((s) => s.addWing);
  const updateWing = useStore((s) => s.updateWing);
  const deleteWing = useStore((s) => s.deleteWing);
  const addRoom = useStore((s) => s.addRoom);
  const updateRoom = useStore((s) => s.updateRoom);
  const deleteRoom = useStore((s) => s.deleteRoom);
  const assignBed = useStore((s) => s.assignBed);

  const [wingDialog, setWingDialog] = useState<"add" | "edit" | null>(null);
  const [wingEditingId, setWingEditingId] = useState<string | null>(null);
  const [wingForm, setWingForm] = useState<WingForm>(EMPTY_WING);
  const [wingDeleteId, setWingDeleteId] = useState<string | null>(null);

  const [roomDialog, setRoomDialog] = useState<"add" | "edit" | null>(null);
  const [roomEditingId, setRoomEditingId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState<RoomForm>(EMPTY_ROOM);
  const [roomDeleteId, setRoomDeleteId] = useState<string | null>(null);

  const [assignBedId, setAssignBedId] = useState<string | null>(null);
  const [assignPatientId, setAssignPatientId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");

  useEffect(() => {
    if (session && !isAdmin) {
      setWingDialog(null);
      setRoomDialog(null);
      setWingDeleteId(null);
      setRoomDeleteId(null);
    }
  }, [session, isAdmin]);

  const usedPrefixes = useMemo(() => new Set(wings.map((w) => w.prefix)), [wings]);
  const sortedWings = useMemo(
    () => [...wings].sort((a, b) => a.prefix - b.prefix),
    [wings],
  );
  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.fullNumber - b.fullNumber),
    [rooms],
  );
  const wingById = useMemo(() => {
    const m = new Map<string, Wing>();
    wings.forEach((w) => m.set(w.id, w));
    return m;
  }, [wings]);
  const patientById = useMemo(() => {
    const m = new Map<string, Patient>();
    patients.forEach((p) => m.set(p.id, p));
    return m;
  }, [patients]);
  const assignedPatientIds = useMemo(() => {
    const ids = new Set<string>();
    rooms.forEach((r) => {
      r.beds.forEach((b) => {
        if (b.patientId) ids.add(b.patientId);
      });
    });
    return ids;
  }, [rooms]);

  const filteredRooms = useMemo(
    () => sortedRooms.filter((r) => roomMatchesQuery(r, wingById, patientById, roomSearchQuery)),
    [sortedRooms, wingById, patientById, roomSearchQuery],
  );

  const showLoading = workspaceDataLoading && wings.length === 0 && rooms.length === 0;

  function nextAvailablePrefix(): number {
    for (let i = 1; i <= 9; i++) {
      if (!usedPrefixes.has(i)) return i;
    }
    return 1;
  }

  // ─── Wings ────────────────────────────────────────────────────────────────
  function openAddWing() {
    if (!isAdmin) {
      toast.error("Solo administración puede crear alas.");
      return;
    }
    setWingEditingId(null);
    setWingForm({ ...EMPTY_WING, prefix: nextAvailablePrefix() });
    setWingDialog("add");
  }

  function openEditWing(id: string) {
    if (!isAdmin) return;
    const w = wings.find((x) => x.id === id);
    if (!w) return;
    setWingEditingId(id);
    setWingForm({ name: w.name, type: w.type, prefix: w.prefix });
    setWingDialog("edit");
  }

  async function saveWing() {
    if (!isAdmin) {
      toast.error("Solo administración puede modificar alas.");
      return;
    }
    if (saving) return;
    const name = wingForm.name.trim();
    if (!name) {
      toast.error("El nombre del ala es obligatorio.");
      return;
    }
    const prefix = Math.trunc(Number(wingForm.prefix));
    if (!Number.isFinite(prefix) || prefix < 1 || prefix > 9) {
      toast.error("El prefijo debe ser un dígito entre 1 y 9.");
      return;
    }
    setSaving(true);
    try {
      if (wingDialog === "add") {
        await addWing({ name, type: wingForm.type, prefix });
        toast.success("Ala creada.");
      } else if (wingEditingId) {
        await updateWing(wingEditingId, { name, type: wingForm.type, prefix });
        toast.success("Ala actualizada.");
      }
      setWingDialog(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo guardar el ala.";
      toast.error("Error al guardar", { description: m });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteWing() {
    if (!isAdmin) return;
    if (!wingDeleteId) return;
    try {
      await deleteWing(wingDeleteId);
      toast.success("Ala eliminada.");
      setWingDeleteId(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo eliminar el ala.";
      toast.error("No se pudo eliminar", { description: m });
    }
  }

  // ─── Rooms ────────────────────────────────────────────────────────────────
  function nextAvailableRoomNumber(wingId: string): number {
    const used = new Set(rooms.filter((r) => r.wingId === wingId).map((r) => r.number));
    for (let i = 1; i <= 99; i++) {
      if (!used.has(i)) return i;
    }
    return 1;
  }

  function openAddRoom() {
    if (!isAdmin) {
      toast.error("Solo administración puede crear salas.");
      return;
    }
    if (wings.length === 0) {
      toast.error("Primero creá un ala para poder asignar salas.");
      return;
    }
    setRoomEditingId(null);
    const wingId = wings[0].id;
    setRoomForm({ wingId, number: nextAvailableRoomNumber(wingId), bedCount: 1 });
    setRoomDialog("add");
  }

  function openEditRoom(id: string) {
    if (!isAdmin) return;
    const r = rooms.find((x) => x.id === id);
    if (!r) return;
    setRoomEditingId(id);
    setRoomForm({ wingId: r.wingId, number: r.number, bedCount: r.bedCount });
    setRoomDialog("edit");
  }

  async function saveRoom() {
    if (!isAdmin) {
      toast.error("Solo administración puede modificar salas.");
      return;
    }
    if (saving) return;
    if (!roomForm.wingId) {
      toast.error("Seleccioná un ala para la sala.");
      return;
    }
    const number = Math.trunc(Number(roomForm.number));
    if (!Number.isFinite(number) || number < 1 || number > 99) {
      toast.error("El número de sala debe estar entre 01 y 99.");
      return;
    }
    const bedCount = Math.trunc(Number(roomForm.bedCount));
    if (!Number.isFinite(bedCount) || bedCount < 1 || bedCount > 4) {
      toast.error("La sala debe tener entre 1 y 4 camas.");
      return;
    }
    setSaving(true);
    try {
      if (roomDialog === "add") {
        await addRoom({ wingId: roomForm.wingId, number, bedCount });
        toast.success("Sala creada.");
      } else if (roomEditingId) {
        await updateRoom(roomEditingId, { wingId: roomForm.wingId, number, bedCount });
        toast.success("Sala actualizada.");
      }
      setRoomDialog(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo guardar la sala.";
      toast.error("Error al guardar", { description: m });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRoom() {
    if (!isAdmin) return;
    if (!roomDeleteId) return;
    try {
      await deleteRoom(roomDeleteId);
      toast.success("Sala eliminada.");
      setRoomDeleteId(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo eliminar la sala.";
      toast.error("No se pudo eliminar", { description: m });
    }
  }

  // ─── Bed assignment ───────────────────────────────────────────────────────
  function openAssignBed(bedId: string) {
    setAssignBedId(bedId);
    setAssignPatientId("");
  }

  async function saveAssignBed() {
    if (!assignBedId || !assignPatientId) {
      toast.error("Seleccioná un paciente.");
      return;
    }
    try {
      await assignBed(assignBedId, assignPatientId);
      toast.success("Paciente asignado a la cama.");
      setAssignBedId(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo asignar la cama.";
      toast.error("Error", { description: m });
    }
  }

  async function clearBed(bedId: string) {
    try {
      await assignBed(bedId, null);
      toast.success("Cama liberada.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo liberar la cama.";
      toast.error("Error", { description: m });
    }
  }

  const availablePatientsForAssign = useMemo(() => {
    return patients.filter(
      (p) => p.workspaceId === session?.workspaceId && !assignedPatientIds.has(p.id),
    );
  }, [patients, assignedPatientIds, session?.workspaceId]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Salas"
        description={
          isAdmin
            ? "Gestión de alas médicas, salas y asignación de camas a pacientes."
            : "Asigná o liberá camas en las salas existentes. Crear alas o salas solo puede hacerlo administración."
        }
      />

      {showLoading ? (
        <WorkspaceLoadingPlaceholder
          title="Cargando salas"
          description="Sincronizando alas, salas y camas del workspace…"
        />
      ) : (
        <>
          {/* ─── Wings (Alas) ──────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm">
                  Alas médicas ({wings.length})
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada ala agrupa salas con un prefijo de numeración único (1xx, 2xx, …).
                  {!isAdmin && " Solo administración puede crear o editar alas."}
                </p>
              </div>
              {isAdmin && (
              <Button onClick={openAddWing} size="sm" disabled={usedPrefixes.size >= 9}>
                <Plus className="mr-1.5 h-4 w-4" /> Nueva ala
              </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {sortedWings.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Building className="mx-auto mb-2 h-8 w-8 opacity-35" />
                  <p className="font-medium text-foreground">No hay alas registradas</p>
                  <p className="mt-1 text-xs">
                    {isAdmin
                      ? "Creá la primera ala para comenzar a definir salas."
                      : "Pedí a administración que cargue las alas del establecimiento."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 p-3 md:hidden">
                    {sortedWings.map((w) => {
                      const roomCount = rooms.filter((r) => r.wingId === w.id).length;
                      return (
                        <Card key={w.id} className="shadow-sm">
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold leading-tight">{w.name}</p>
                                <p className="mt-1 font-mono text-xs text-muted-foreground">Prefijo {w.prefix}xx</p>
                                <Badge variant="outline" className={`mt-2 ${WING_TYPE_BADGE[w.type]}`}>
                                  {WING_TYPE_LABEL[w.type]}
                                </Badge>
                              </div>
                              {isAdmin ? (
                                <div className="flex shrink-0 gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => openEditWing(w.id)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setWingDeleteId(w.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{roomCount}</span> sala
                              {roomCount === 1 ? "" : "s"} en esta ala
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Prefijo</TableHead>
                          <TableHead className="text-right">Salas</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedWings.map((w) => {
                          const roomCount = rooms.filter((r) => r.wingId === w.id).length;
                          return (
                            <TableRow key={w.id}>
                              <TableCell className="font-medium">{w.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={WING_TYPE_BADGE[w.type]}>
                                  {WING_TYPE_LABEL[w.type]}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{w.prefix}xx</TableCell>
                              <TableCell className="text-right text-sm">{roomCount}</TableCell>
                              <TableCell className="text-right">
                                {isAdmin ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditWing(w.id)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setWingDeleteId(w.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ─── Rooms (Salas) ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm">
                  Salas ({rooms.length})
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada sala pertenece a un ala, hereda su tipo y puede tener entre 1 y 4 camas.
                  {!isAdmin && " Solo administración puede crear o editar salas."}
                </p>
              </div>
              {isAdmin && (
              <Button
                onClick={openAddRoom}
                size="sm"
                disabled={wings.length === 0}
                title={wings.length === 0 ? "Creá primero un ala" : undefined}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Nueva sala
              </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 p-3 sm:px-6">
              {sortedRooms.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="salas-buscar" className="text-sm">
                    Buscar en la lista
                  </Label>
                  <div className="relative max-w-xl">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="salas-buscar"
                      type="search"
                      autoComplete="off"
                      placeholder="Número de sala, ala, tipo, paciente, cama libre…"
                      className="pl-9"
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                    />
                  </div>
                  {roomSearchQuery.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Mostrando {filteredRooms.length} de {sortedRooms.length} sala
                      {sortedRooms.length === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                </div>
              )}
              {sortedRooms.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                  <BedDouble className="mx-auto mb-2 h-8 w-8 opacity-35" />
                  <p className="font-medium text-foreground">No hay salas registradas</p>
                  <p className="mt-1 text-xs">
                    {wings.length === 0
                      ? isAdmin
                        ? "Primero registrá un ala para poder crear salas."
                        : "Aún no hay estructura de internación. Pedí a administración que cargue alas y salas."
                      : isAdmin
                        ? "Creá la primera sala asignándola a un ala."
                        : "Pedí a administración que dé de alta las salas en cada ala."}
                  </p>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <p>No hay salas que coincidan con «{roomSearchQuery.trim()}».</p>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto px-0 text-primary"
                    onClick={() => setRoomSearchQuery("")}
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredRooms.map((room) => {
                    const wing = wingById.get(room.wingId);
                    const occupied = room.beds.filter((b) => b.patientId).length;
                    return (
                      <Card key={room.id} className="overflow-hidden">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-lg font-semibold leading-tight">
                                Sala {room.fullNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {wing?.name ?? "—"}
                              </p>
                              {wing && (
                                <Badge
                                  variant="outline"
                                  className={`mt-2 ${WING_TYPE_BADGE[wing.type]}`}
                                >
                                  {WING_TYPE_LABEL[wing.type]}
                                </Badge>
                              )}
                            </div>
                            {isAdmin ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditRoom(room.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setRoomDeleteId(room.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-md border bg-muted/30 p-2 text-xs">
                            <p className="mb-2 font-medium">
                              Camas {occupied}/{room.bedCount}
                            </p>
                            <ul className="space-y-1.5">
                              {room.beds.map((bed) => {
                                const patient = bed.patientId
                                  ? patientById.get(bed.patientId)
                                  : null;
                                return (
                                  <li
                                    key={bed.id}
                                    className="flex items-center justify-between gap-2 rounded-sm bg-background px-2 py-1.5"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <BedDouble className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      <span className="font-mono text-[11px] text-muted-foreground">
                                        #{bed.position}
                                      </span>
                                      {patient ? (
                                        <span className="truncate font-medium text-foreground">
                                          {patient.lastName}, {patient.firstName}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">Libre</span>
                                      )}
                                    </div>
                                    {patient ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-1.5 text-destructive hover:text-destructive"
                                        onClick={() => clearBed(bed.id)}
                                      >
                                        <UserX className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-1.5"
                                        onClick={() => openAssignBed(bed.id)}
                                      >
                                        <UserRound className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Wing dialog ────────────────────────────────────────────────── */}
      <Dialog open={wingDialog !== null} onOpenChange={(open) => !open && setWingDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {wingDialog === "add" ? "Nueva ala" : "Editar ala"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del ala</Label>
              <Input
                placeholder="Ej: Ala Norte"
                value={wingForm.name}
                onChange={(e) => setWingForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={wingForm.type}
                onValueChange={(v) => setWingForm((f) => ({ ...f, type: v as WingType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(WING_TYPE_LABEL) as [WingType, string][]).map(
                    ([type, label]) => (
                      <SelectItem key={type} value={type}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prefijo (1-9)</Label>
              <Select
                value={String(wingForm.prefix)}
                onValueChange={(v) => setWingForm((f) => ({ ...f, prefix: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                    const used =
                      usedPrefixes.has(n) &&
                      !(wingDialog === "edit" &&
                        wings.find((w) => w.id === wingEditingId)?.prefix === n);
                    return (
                      <SelectItem key={n} value={String(n)} disabled={used}>
                        {n}xx {used ? "(usado)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Las salas dentro de esta ala se numerarán como {wingForm.prefix}01, {wingForm.prefix}02, …
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWingDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveWing} disabled={saving}>
              {saving ? "Guardando..." : wingDialog === "add" ? "Crear ala" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Wing delete confirm ───────────────────────────────────────── */}
      <Dialog
        open={wingDeleteId !== null}
        onOpenChange={(open) => !open && setWingDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ala</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción elimina el ala seleccionada. Si tiene salas asociadas la base de datos rechazará la eliminación.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWingDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteWing}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Room dialog ───────────────────────────────────────────────── */}
      <Dialog open={roomDialog !== null} onOpenChange={(open) => !open && setRoomDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roomDialog === "add" ? "Nueva sala" : "Editar sala"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ala asignada</Label>
              <Select
                value={roomForm.wingId}
                onValueChange={(v) =>
                  setRoomForm((f) => ({
                    ...f,
                    wingId: v,
                    number:
                      roomDialog === "add"
                        ? nextAvailableRoomNumber(v)
                        : f.number,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un ala..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedWings.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} · {w.prefix}xx ({WING_TYPE_LABEL[w.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roomForm.wingId && (
                <p className="text-xs text-muted-foreground">
                  Tipo automático: <span className="font-medium text-foreground">{
                    WING_TYPE_LABEL[wingById.get(roomForm.wingId)?.type ?? "hospitalizacion"]
                  }</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número de sala (01–99)</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={roomForm.number}
                  onChange={(e) =>
                    setRoomForm((f) => ({ ...f, number: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Número completo:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {roomForm.wingId
                      ? `${wingById.get(roomForm.wingId)?.prefix ?? "?"}${pad2(roomForm.number)}`
                      : "—"}
                  </span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad de camas (1–4)</Label>
                <Select
                  value={String(roomForm.bedCount)}
                  onValueChange={(v) =>
                    setRoomForm((f) => ({ ...f, bedCount: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} cama{n === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveRoom} disabled={saving}>
              {saving ? "Guardando..." : roomDialog === "add" ? "Crear sala" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Room delete confirm ───────────────────────────────────────── */}
      <Dialog
        open={roomDeleteId !== null}
        onOpenChange={(open) => !open && setRoomDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar sala</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción elimina la sala y sus camas. No se puede eliminar si hay pacientes asignados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRoom}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Assign bed dialog ─────────────────────────────────────────── */}
      <Dialog
        open={assignBedId !== null}
        onOpenChange={(open) => !open && setAssignBedId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar paciente a cama</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Paciente</Label>
            {availablePatientsForAssign.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pacientes disponibles. Todos los pacientes ya están asignados a una cama o aún no hay pacientes registrados.
              </p>
            ) : (
              <Select value={assignPatientId} onValueChange={setAssignPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paciente..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePatientsForAssign.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Cada paciente solo puede estar asignado a una cama a la vez.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignBedId(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAssignBed} disabled={!assignPatientId}>
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

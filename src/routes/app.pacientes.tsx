import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BedDouble, Loader2, LogOut, Pencil, Search, Trash2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { requireAdminOrDoctor } from "@/lib/route-guards";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { WING_TYPE_LABEL } from "@/lib/domain-types";
import { getAdmissionDisplayStatus } from "@/lib/patient-admission";
import { PatientAdmissionBadge } from "@/components/patients/patient-admission-badge";
import { RegisterInternmentDialog } from "@/components/patients/register-internment-dialog";

export const Route = createFileRoute("/app/pacientes")({
  beforeLoad: requireAdminOrDoctor,
  component: PacientesPage,
});

const EMPTY = {
  firstName: "",
  lastName: "",
  insurance: "",
  diagnosis: "",
  assignedDoctor: "",
  wingId: "",
  roomId: "",
  bedId: "",
};

const NONE_VALUE = "__none__";

function PacientesPage() {
  const session = useStore((s) => s.session);
  const patients = useStore((s) => s.patients);
  const wings = useStore((s) => s.wings);
  const rooms = useStore((s) => s.rooms);
  const users = useStore((s) => s.users);
  const addPatient = useStore((s) => s.addPatient);
  const updatePatient = useStore((s) => s.updatePatient);
  const deletePatient = useStore((s) => s.deletePatient);
  const assignBed = useStore((s) => s.assignBed);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialBedId, setInitialBedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [dischargingId, setDischargingId] = useState<string | null>(null);
  const [internmentOpen, setInternmentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-pacientes");

  const workspaceWings = useMemo(
    () => wings.filter((w) => w.workspaceId === session?.workspaceId).sort((a, b) => a.prefix - b.prefix),
    [wings, session?.workspaceId],
  );
  const workspaceRooms = useMemo(
    () => rooms.filter((r) => r.workspaceId === session?.workspaceId),
    [rooms, session?.workspaceId],
  );

  const bedToPatient = useMemo(() => {
    const m = new Map<string, string>();
    rooms.forEach((r) => r.beds.forEach((b) => b.patientId && m.set(b.id, b.patientId)));
    return m;
  }, [rooms]);

  const patientToBed = useMemo(() => {
    const m = new Map<string, { bedId: string; roomId: string; wingId: string; position: number; fullNumber: number }>();
    rooms.forEach((r) =>
      r.beds.forEach((b) => {
        if (b.patientId) {
          m.set(b.patientId, {
            bedId: b.id,
            roomId: r.id,
            wingId: r.wingId,
            position: b.position,
            fullNumber: r.fullNumber,
          });
        }
      }),
    );
    return m;
  }, [rooms]);

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [patients],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedPatients;
    return sortedPatients.filter((p) => {
      const bed = patientToBed.get(p.id);
      const locationBits = bed
        ? [`sala ${bed.fullNumber}`, `cama ${bed.position}`, `${bed.fullNumber}`, `${bed.position}`]
        : p.room.trim()
          ? [`sala ${p.room}`, p.room]
          : [];
      const haystack = [
        p.lastName,
        p.firstName,
        p.insurance,
        p.diagnosis,
        p.assignedDoctor,
        p.room,
        ...locationBits,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedPatients, searchQuery, patientToBed]);
  const workspaceDoctors = useMemo(
    () =>
      users.filter((u) => u.workspaceId === session?.workspaceId && u.role === "doctor"),
    [users, session?.workspaceId],
  );

  // Salas filtradas por ala seleccionada
  const filteredRooms = useMemo(
    () => workspaceRooms.filter((r) => r.wingId === form.wingId).sort((a, b) => a.fullNumber - b.fullNumber),
    [workspaceRooms, form.wingId],
  );

  const selectedRoom = workspaceRooms.find((r) => r.id === form.roomId) ?? null;

  function isRoomAvailable(roomId: string): boolean {
    const r = workspaceRooms.find((x) => x.id === roomId);
    if (!r) return false;
    return r.beds.some(
      (b) => !b.patientId || (editingId !== null && b.patientId === editingId),
    );
  }

  function isBedAvailable(bedId: string): boolean {
    const room = workspaceRooms.find((r) => r.beds.some((b) => b.id === bedId));
    if (!room) return false;
    const bed = room.beds.find((b) => b.id === bedId);
    if (!bed) return false;
    if (!bed.patientId) return true;
    return editingId !== null && bed.patientId === editingId;
  }

  function startAdd() {
    setEditingId(null);
    setInitialBedId(null);
    setForm({ ...EMPTY, assignedDoctor: workspaceDoctors[0]?.name ?? "" });
    setOpen(true);
  }

  function startEdit(id: string) {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    const currentBed = patientToBed.get(id) ?? null;
    setEditingId(id);
    setInitialBedId(currentBed?.bedId ?? null);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      insurance: p.insurance,
      diagnosis: p.diagnosis,
      assignedDoctor: p.assignedDoctor,
      wingId: currentBed?.wingId ?? "",
      roomId: currentBed?.roomId ?? "",
      bedId: currentBed?.bedId ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.assignedDoctor.trim()) {
      toast.error("Nombre, apellido y doctor asignado son obligatorios.");
      return;
    }
    if ((form.wingId && !form.roomId) || (form.roomId && !form.bedId)) {
      toast.error("Si seleccionás un ala o sala, también seleccioná la cama de internación.");
      return;
    }
    setSaving(true);
    try {
      const patientPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        insurance: form.insurance.trim(),
        diagnosis: form.diagnosis.trim(),
        assignedDoctor: form.assignedDoctor.trim(),
        room: selectedRoom ? String(selectedRoom.fullNumber) : "",
      };

      if (editingId) {
        await updatePatient(editingId, patientPayload);
        const newBedId = form.bedId || null;
        if (newBedId !== initialBedId) {
          if (newBedId) {
            await assignBed(newBedId, editingId);
          } else if (initialBedId) {
            await assignBed(initialBedId, null);
          }
        }
        toast.success("Paciente actualizado.");
      } else {
        await addPatient({ ...patientPayload, room: patientPayload.room, bedId: form.bedId || null });
        toast.success(
          form.bedId
            ? `Paciente creado y asignado a Sala ${selectedRoom?.fullNumber}.`
            : "Paciente creado.",
        );
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el paciente.";
      toast.error("No se pudo guardar", { description: message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deletePatient(id);
      toast.success("Paciente eliminado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el paciente.";
      toast.error("Error", { description: message });
    }
  }

  async function discharge(id: string) {
    const bed = patientToBed.get(id);
    if (!bed) {
      toast.message("El paciente no tiene cama asignada.");
      return;
    }
    setDischargingId(id);
    try {
      await assignBed(bed.bedId, null);
      toast.success("Paciente dado de alta", {
        description: `Sala ${bed.fullNumber} · Cama ${bed.position} liberada.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo dar el alta.";
      toast.error("Error", { description: message });
    } finally {
      setDischargingId(null);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h1 className="text-xl font-semibold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">ABM básico de pacientes de la Institución.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="secondary" onClick={() => setInternmentOpen(true)} className="w-full sm:w-auto">
            <BedDouble className="mr-2 h-4 w-4" />
            Registrar internación
          </Button>
          <Button onClick={startAdd} className="w-full sm:w-auto">
            <UserRoundPlus className="mr-2 h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Listado</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? `${filteredRows.length} de ${sortedPatients.length} paciente${sortedPatients.length === 1 ? "" : "s"} con la búsqueda actual`
                  : `${sortedPatients.length} paciente${sortedPatients.length === 1 ? "" : "s"} registrado${sortedPatients.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, apellido, obra social, médico, sala…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filtrar pacientes"
              />
            </div>
          </div>
          {isMobile && (
            <div>
              <MobileViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isMobile && viewMode === "cards" ? (
            <div className="space-y-3 p-3">
              {filteredRows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {sortedPatients.length === 0
                    ? "Todavía no hay pacientes registrados en esta Institución."
                    : "Ningún paciente coincide con la búsqueda. Probá con otro texto o limpiá el filtro."}
                </div>
              ) : (
                filteredRows.map((p) => {
                  const bed = patientToBed.get(p.id) ?? null;
                  const admission = getAdmissionDisplayStatus(p.id, patientToBed, p.room);
                  return (
                    <Card key={p.id}>
                      <CardContent className="space-y-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {p.lastName}, {p.firstName}
                          </p>
                          <PatientAdmissionBadge status={admission} />
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Obra social: {p.insurance || "—"}</p>
                          <p>Diagnóstico: {p.diagnosis || "—"}</p>
                          <p>Médico asignado: {p.assignedDoctor}</p>
                          <p>
                            Ubicación:{" "}
                            {bed ? (
                              <span className="font-medium text-foreground">
                                Sala {bed.fullNumber} · Cama {bed.position}
                              </span>
                            ) : p.room.trim() ? (
                              <span className="font-medium text-foreground">Sala {p.room} (sin cama en sistema)</span>
                            ) : (
                              <span className="italic">—</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(p.id)}>
                            Editar
                          </Button>
                          {bed && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={dischargingId === p.id}
                              onClick={() => discharge(p.id)}
                            >
                              {dischargingId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                                  Dar de alta
                                </>
                              )}
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Obra social</TableHead>
                    <TableHead className="hidden lg:table-cell">Diagnóstico</TableHead>
                    <TableHead className="hidden md:table-cell">Médico asignado</TableHead>
                    <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                        {sortedPatients.length === 0
                          ? "Todavía no hay pacientes registrados en esta Institución."
                          : "Ningún paciente coincide con la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((p) => {
                      const bed = patientToBed.get(p.id) ?? null;
                      const admission = getAdmissionDisplayStatus(p.id, patientToBed, p.room);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.lastName}, {p.firstName}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <PatientAdmissionBadge status={admission} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{p.insurance || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell">{p.diagnosis || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell">{p.assignedDoctor}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">
                            {bed ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                                <BedDouble className="h-3 w-3" />
                                Sala {bed.fullNumber} · Cama {bed.position}
                              </span>
                            ) : p.room.trim() ? (
                              <span className="text-muted-foreground">Sala {p.room}</span>
                            ) : (
                              <span className="italic text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {bed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={dischargingId === p.id}
                                  onClick={() => discharge(p.id)}
                                  title="Dar de alta y liberar la cama"
                                  className="text-emerald-700 hover:text-emerald-800"
                                >
                                  {dischargingId === p.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <LogOut className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => startEdit(p.id)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => remove(p.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setSaving(false);
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.firstName}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input
                value={form.lastName}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Obra social</Label>
              <Input
                value={form.insurance}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Médico asignado</Label>
              <Select
                value={form.assignedDoctor}
                disabled={saving}
                onValueChange={(value) => setForm((f) => ({ ...f, assignedDoctor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar médico..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaceDoctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.name}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Diagnóstico</Label>
              <Input
                value={form.diagnosis}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              />
            </div>

            {/* ─── Internación: Ala / Sala / Cama ───────────────────── */}
            <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Internación</p>
                <span className="text-[11px] text-muted-foreground">
                  (opcional · una sala sin camas libres se muestra deshabilitada)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ala</Label>
                  <Select
                    value={form.wingId || NONE_VALUE}
                    disabled={saving || workspaceWings.length === 0}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        wingId: v === NONE_VALUE ? "" : v,
                        roomId: "",
                        bedId: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={workspaceWings.length === 0 ? "Sin alas" : "Sin asignar"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Sin asignar</SelectItem>
                      {workspaceWings.map((w) => (
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
                    value={form.roomId || NONE_VALUE}
                    disabled={saving || !form.wingId || filteredRooms.length === 0}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        roomId: v === NONE_VALUE ? "" : v,
                        bedId: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !form.wingId
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
                        const available = isRoomAvailable(r.id);
                        const free = r.beds.filter(
                          (b) => !b.patientId || (editingId !== null && b.patientId === editingId),
                        ).length;
                        return (
                          <SelectItem key={r.id} value={r.id} disabled={!available}>
                            <span className={!available ? "opacity-50" : undefined}>
                              Sala {r.fullNumber} · {free}/{r.bedCount} libre{free === 1 ? "" : "s"}
                              {!available ? " · sin disponibilidad" : ""}
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
                    value={form.bedId || NONE_VALUE}
                    disabled={saving || !form.roomId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, bedId: v === NONE_VALUE ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={!form.roomId ? "Elegí una sala primero" : "Sin cama"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Sin cama</SelectItem>
                      {selectedRoom?.beds.map((b) => {
                        const available = isBedAvailable(b.id);
                        const occupantId = bedToPatient.get(b.id);
                        const occupant = occupantId
                          ? patients.find((p) => p.id === occupantId)
                          : null;
                        const isCurrent = editingId !== null && occupantId === editingId;
                        return (
                          <SelectItem key={b.id} value={b.id} disabled={!available}>
                            <span className={!available ? "opacity-50" : undefined}>
                              Cama {b.position}
                              {isCurrent
                                ? " · actual"
                                : occupant
                                ? ` · ${occupant.lastName}, ${occupant.firstName}`
                                : " · libre"}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {workspaceWings.length === 0 && (
                <p className="text-xs text-amber-700">
                  No hay alas registradas en este workspace. Creá alas y salas desde la sección{" "}
                  <span className="font-medium">Internación → Salas</span> para poder asignar internaciones.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Guardando...
                </>
              ) : editingId ? (
                "Guardar cambios"
              ) : (
                "Crear paciente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegisterInternmentDialog open={internmentOpen} onOpenChange={setInternmentOpen} />
    </div>
  );
}

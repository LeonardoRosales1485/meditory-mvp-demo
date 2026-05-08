import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Trash2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { requireAuth } from "@/lib/route-guards";
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

export const Route = createFileRoute("/app/pacientes")({
  beforeLoad: requireAuth,
  component: PacientesPage,
});

const EMPTY = {
  firstName: "",
  lastName: "",
  insurance: "",
  diagnosis: "",
  assignedDoctor: "",
  room: "",
};

function PacientesPage() {
  const session = useStore((s) => s.session);
  const patients = useStore((s) => s.patients);
  const addPatient = useStore((s) => s.addPatient);
  const updatePatient = useStore((s) => s.updatePatient);
  const deletePatient = useStore((s) => s.deletePatient);
  const users = useStore((s) => s.users);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const rows = useMemo(
    () => [...patients].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [patients],
  );
  const workspaceDoctors = useMemo(
    () =>
      users.filter(
        (u) => u.workspaceId === session?.workspaceId && u.role === "doctor",
      ),
    [users, session?.workspaceId],
  );

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, assignedDoctor: workspaceDoctors[0]?.name ?? "" });
    setOpen(true);
  }

  function startEdit(id: string) {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      insurance: p.insurance,
      diagnosis: p.diagnosis,
      assignedDoctor: p.assignedDoctor,
      room: p.room,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.assignedDoctor.trim()) {
      toast.error("Nombre, apellido y doctor asignado son obligatorios.");
      return;
    }
    if (editingId) {
      await updatePatient(editingId, form);
      toast.success("Paciente actualizado.");
    } else {
      await addPatient(form);
      toast.success("Paciente creado.");
    }
    setOpen(false);
  }

  async function remove(id: string) {
    await deletePatient(id);
    toast.success("Paciente eliminado.");
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">ABM básico de pacientes del workspace.</p>
        </div>
        <Button onClick={startAdd}>
          <UserRoundPlus className="mr-2 h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{rows.length} paciente{rows.length === 1 ? "" : "s"} registrado{rows.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Obra social</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Médico asignado</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.lastName}, {p.firstName}</TableCell>
                  <TableCell>{p.insurance || "—"}</TableCell>
                  <TableCell>{p.diagnosis || "—"}</TableCell>
                  <TableCell>{p.assignedDoctor}</TableCell>
                  <TableCell>{p.room || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Obra social</Label>
              <Input value={form.insurance} onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sala</Label>
              <Input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Diagnóstico</Label>
              <Input value={form.diagnosis} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Médico asignado</Label>
              <Select
                value={form.assignedDoctor}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Guardar cambios" : "Crear paciente"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

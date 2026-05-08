import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useState } from "react";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ConcentrationUnit, type Medication } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNITS: ConcentrationUnit[] = ["mg", "mcg", "ml", "L", "g", "unidad"];

export const Route = createFileRoute("/app/catalogo")({
  beforeLoad: requireAdmin,
  component: CatalogPage,
});

function CatalogPage() {
  const medications = useStore((s) => s.medications);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addMedication = useStore((s) => s.addMedication);
  const updateMedication = useStore((s) => s.updateMedication);
  const deleteMedication = useStore((s) => s.deleteMedication);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState<Omit<Medication, "id">>({
    name: "",
    activeIngredient: "",
    concentrationValue: 0,
    concentrationUnit: "mg",
    form: "",
  });

  function startNew() {
    setEditing(null);
    setForm({ name: "", activeIngredient: "", concentrationValue: 0, concentrationUnit: "mg", form: "" });
    setOpen(true);
  }
  function startEdit(m: Medication) {
    setEditing(m);
    setForm({ name: m.name, activeIngredient: m.activeIngredient, concentrationValue: m.concentrationValue, concentrationUnit: m.concentrationUnit, form: m.form });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || form.concentrationValue <= 0) return toast.error("Nombre y concentración son obligatorios");
    setSaving(true);
    try {
      if (editing) {
        await updateMedication(editing.id, form);
        toast.success("Medicamento actualizado");
      } else {
        await addMedication(form);
        toast.success("Medicamento agregado");
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el medicamento.";
      toast.error("No se pudo guardar", { description: message });
    } finally {
      setSaving(false);
    }
  }
  async function remove(m: Medication) {
    await deleteMedication(m.id);
    toast.success(`Eliminado: ${m.name}`);
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de medicamentos"
        description="Alta, edición y baja de medicamentos del sistema."
        action={
          <Button onClick={startNew} disabled={workspaceDataLoading}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo medicamento
          </Button>
        }
      />
      <Card>
        <CardContent className="px-0">
          {workspaceDataLoading && medications.length === 0 ? (
            <WorkspaceLoadingPlaceholder
              title="Cargando catálogo"
              description="Sincronizando medicamentos con el servidor…"
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Principio activo</TableHead>
                <TableHead>Concentración</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    <BookOpen className="mx-auto mb-2 h-5 w-5 opacity-40" />
                    Catálogo vacío
                  </TableCell>
                </TableRow>
              )}
              {medications.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.activeIngredient}</TableCell>
                  <TableCell>{m.concentrationValue}{m.concentrationUnit}</TableCell>
                  <TableCell className="text-sm">{m.form}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(m)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="hidden" />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar medicamento" : "Nuevo medicamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre comercial</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Principio activo</Label>
              <Input value={form.activeIngredient} onChange={(e) => setForm({ ...form, activeIngredient: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Concentración</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="flex-1"
                  placeholder="500"
                  value={form.concentrationValue || ""}
                  onChange={(e) => setForm({ ...form, concentrationValue: Number(e.target.value) })}
                />
                <Select
                  value={form.concentrationUnit}
                  onValueChange={(v) => setForm({ ...form, concentrationUnit: v as ConcentrationUnit })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma farmacéutica</Label>
              <Input value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} placeholder="Comprimido" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear medicamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

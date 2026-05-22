import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, BookOpen, Eye } from "lucide-react";
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
import {
  type ConcentrationUnit,
  type Medication,
  type MedicationOrder,
  type TransferRequest,
} from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

const UNITS: ConcentrationUnit[] = ["mg", "mcg", "ml", "L", "g", "unidad"];

const TERMINAL_TRANSFER_STATUS = new Set<TransferRequest["status"]>(["aceptado", "rechazado"]);
const TERMINAL_ORDER_STATUS = new Set<MedicationOrder["status"]>([
  "administrado",
  "rechazado",
  "devuelto",
  "devolucion_rechazada",
]);

function medicationDeleteGuard(
  medicationId: string,
  batchesList: { medicationId: string; quantity: number }[],
  transfersList: TransferRequest[],
  ordersList: MedicationOrder[],
) {
  const stockTotal = batchesList
    .filter((b) => b.medicationId === medicationId)
    .reduce((acc, b) => acc + b.quantity, 0);
  const activeTransfers = transfersList.filter(
    (t) => t.medicationId === medicationId && !TERMINAL_TRANSFER_STATUS.has(t.status),
  );
  const activeOrders = ordersList.filter(
    (o) => o.medicationId === medicationId && !TERMINAL_ORDER_STATUS.has(o.status),
  );
  const reasons: string[] = [];
  if (stockTotal > 0) {
    reasons.push(
      `Hay stock asociado: ${stockTotal.toLocaleString("es-AR")} u en total (suma de lotes de este medicamento en todos los depósitos).`,
    );
  }
  if (activeTransfers.length > 0) {
    reasons.push(
      `Hay ${activeTransfers.length} transferencia${activeTransfers.length === 1 ? "" : "s"} de stock activa${activeTransfers.length === 1 ? "" : "s"} (estado distinto de aceptada o rechazada).`,
    );
  }
  if (activeOrders.length > 0) {
    reasons.push(
      `Hay ${activeOrders.length} pedido${activeOrders.length === 1 ? "" : "s"} médico${activeOrders.length === 1 ? "" : "s"} en curso (no finalizado en administrado, rechazado, devuelto o devolución rechazada).`,
    );
  }
  return { ok: reasons.length === 0, reasons, stockTotal };
}

export const Route = createFileRoute("/app/catalogo")({
  beforeLoad: requireAdmin,
  component: CatalogPage,
});

function CatalogPage() {
  const medicationsAll = useStore((s) => s.medications);
  const batches = useStore((s) => s.batches);
  const transfers = useStore((s) => s.transfers);
  const orders = useStore((s) => s.orders);
  const medications = useMemo(
    () => medicationsAll.filter((m) => !m.deletedAt),
    [medicationsAll],
  );
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addMedication = useStore((s) => s.addMedication);
  const updateMedication = useStore((s) => s.updateMedication);
  const deleteMedication = useStore((s) => s.deleteMedication);

  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-catalogo");
  const pendingDeleteGuard = useMemo(
    () => (deleteConfirm ? medicationDeleteGuard(deleteConfirm, batches, transfers, orders) : null),
    [deleteConfirm, batches, transfers, orders],
  );
  const [form, setForm] = useState<Omit<Medication, "id">>({
    name: "",
    activeIngredient: "",
    concentrationValue: 0,
    concentrationUnit: "mg",
    form: "",
    salePrice: 0,
  });

  function startNew() {
    setEditing(null);
    setForm({
      name: "",
      activeIngredient: "",
      concentrationValue: 0,
      concentrationUnit: "mg",
      form: "",
      salePrice: 0,
    });
    setOpen(true);
  }
  function startEdit(m: Medication) {
    setEditing(m);
    setForm({
      name: m.name,
      activeIngredient: m.activeIngredient,
      concentrationValue: m.concentrationValue,
      concentrationUnit: m.concentrationUnit,
      form: m.form,
      salePrice: m.salePrice,
    });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || form.concentrationValue <= 0) return toast.error("Nombre y concentración son obligatorios");
    if (form.salePrice < 0 || Number.isNaN(form.salePrice)) return toast.error("Precio de venta inválido");
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
  async function confirmDeleteMedication() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteMedication(deleteConfirm);
      setDeleteConfirm(null);
      toast.success("Medicamento dado de baja del catálogo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la baja.";
      toast.error("No se pudo dar de baja", { description: message });
    } finally {
      setDeleting(false);
    }
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
          {isMobile && (
            <div className="px-3 pb-3">
              <MobileViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
          {workspaceDataLoading && medications.length === 0 ? (
            <WorkspaceLoadingPlaceholder
              title="Cargando catálogo"
              description="Sincronizando medicamentos con el servidor…"
            />
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 p-3">
              {medications.length === 0 ? (
                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  Catálogo vacío
                </div>
              ) : (
                medications.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="space-y-2 p-4">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.activeIngredient}</p>
                      <p className="text-xs">{m.concentrationValue}{m.concentrationUnit} · {m.form}</p>
                      <p className="text-xs text-muted-foreground">
                        P. venta: <span className="font-semibold text-foreground">${m.salePrice.toLocaleString("es-AR")}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="icon" aria-label="Ver en inventario">
                          <Link to="/app/inventario" search={{ medicamento: m.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEdit(m)}>Editar</Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(m.id)}>
                          Dar de baja
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Principio activo</TableHead>
                <TableHead>Concentración</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">P. venta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
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
                  <TableCell className="text-right tabular-nums">${m.salePrice.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon" aria-label="Ver lotes en inventario">
                      <Link to="/app/inventario" search={{ medicamento: m.id }}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(m)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(m.id)}
                      aria-label="Dar de baja medicamento"
                    >
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
            <div className="space-y-2">
              <Label>Precio de venta (mostrador)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Lista de precios de la Institución; las ventas guardan el valor vigente al momento de registrar.</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear medicamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(isOpen) => !isOpen && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja medicamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Vas a dar de baja{" "}
              <span className="font-medium text-foreground">
                {deleteConfirm ? medications.find((x) => x.id === deleteConfirm)?.name ?? "este ítem" : ""}
              </span>{" "}
              del catálogo operativo. Para poder confirmar, deben cumplirse todas estas condiciones:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Sin stock:</span> la suma de unidades en todos los
                lotes de ese medicamento (en cualquier depósito) debe ser{" "}
                <strong className="text-foreground">cero</strong>.
              </li>
              <li>
                <span className="font-medium text-foreground">Sin stock en movimiento:</span> no debe haber
                transferencias activas ni pedidos médicos en curso que referencien ese medicamento (transferencias
                finalizadas solo en estado aceptada o rechazada; pedidos cerrados en administrado, rechazado, devuelto
                o devolución rechazada).
              </li>
              <li>
                <span className="font-medium text-foreground">Baja lógica:</span> el registro no se borra de la base
                de datos: deja de mostrarse en el catálogo para operaciones nuevas y permanece vinculado al historial.
              </li>
            </ul>
            {pendingDeleteGuard && !pendingDeleteGuard.ok ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive">
                <p className="font-medium text-foreground">Aún no se cumplen las condiciones:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {pendingDeleteGuard.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteMedication()}
              disabled={deleting || (pendingDeleteGuard !== null && !pendingDeleteGuard.ok)}
            >
              {deleting ? "Procesando…" : "Confirmar baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

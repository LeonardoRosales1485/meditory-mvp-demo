import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, PackageSearch, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDate, medName, type Warehouse } from "@/lib/domain-types";
import { requireAdmin } from "@/lib/route-guards";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/depositos")({
  beforeLoad: requireAdmin,
  component: WarehousesPage,
});

type WarehouseForm = {
  name: string;
  type: Warehouse["type"];
};

const EMPTY_FORM: WarehouseForm = {
  name: "",
  type: "central",
};

const TYPE_LABEL: Record<Warehouse["type"], string> = {
  central: "Central",
  interna: "Interna",
  ventas: "Ventas",
};

function WarehousesPage() {
  const session = useStore((s) => s.session);
  const warehouses = useStore((s) => s.warehouses);
  const batches = useStore((s) => s.batches);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addWarehouse = useStore((s) => s.addWarehouse);
  const updateWarehouse = useStore((s) => s.updateWarehouse);
  const deleteWarehouse = useStore((s) => s.deleteWarehouse);

  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) ?? null;
  const hasCentral = warehouses.some((w) => w.type === "central");
  const editingWarehouse = warehouses.find((w) => w.id === editingId) ?? null;
  const isAddMode = dialogMode === "add";
  const allowCentralInForm = isAddMode
    ? !hasCentral
    : editingWarehouse?.type === "central" || !hasCentral;
  const allowedTypes: Warehouse["type"][] = useMemo(() => {
    if (isAddMode && !hasCentral) return ["central"];
    if (!allowCentralInForm) return ["interna", "ventas"];
    return ["central", "interna", "ventas"];
  }, [isAddMode, hasCentral, allowCentralInForm]);
  const selectedStock = useMemo(
    () =>
      selectedWarehouse
        ? batches
            .filter((b) => b.warehouseId === selectedWarehouse.id)
            .sort((a, b) => +new Date(a.expiry) - +new Date(b.expiry))
        : [],
    [batches, selectedWarehouse],
  );

  const showLoading = workspaceDataLoading && warehouses.length === 0;
  const showEmpty = !workspaceDataLoading && warehouses.length === 0;

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", type: hasCentral ? "interna" : "central" });
    setDialogMode("add");
  }

  function openEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setForm({ name: warehouse.name, type: warehouse.type });
    setDialogMode("edit");
  }

  async function saveWarehouse() {
    if (!form.name.trim()) {
      toast.error("El nombre del depósito es obligatorio.");
      return;
    }
    if (!hasCentral && form.type !== "central") {
      toast.error("Si no existe depósito central, el primero debe ser Central.");
      return;
    }
    if (hasCentral && isAddMode && form.type === "central") {
      toast.error("Ya existe un depósito central. No se puede crear otro.");
      return;
    }
    setSaving(true);
    try {
      if (dialogMode === "add") {
        await addWarehouse(form);
        toast.success("Depósito creado.");
      } else if (editingId) {
        await updateWarehouse(editingId, form);
        toast.success("Depósito actualizado.");
      }
      setDialogMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el depósito.";
      toast.error("Error al guardar", { description: message });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteWarehouse(deleteConfirm);
      if (selectedWarehouseId === deleteConfirm) setSelectedWarehouseId("");
      setDeleteConfirm(null);
      toast.success("Depósito eliminado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el depósito.";
      toast.error("No se pudo eliminar", { description: message });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depósitos"
        description="Gestión de depósitos y visualización completa de stock por depósito."
        action={
          <Button onClick={openAdd} disabled={showLoading}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo depósito
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardContent className="px-0">
            {showLoading ? (
              <WorkspaceLoadingPlaceholder
                title="Cargando depósitos"
                description="Sincronizando depósitos del workspace…"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Stock total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showEmpty && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                        <Building2 className="mx-auto mb-2 h-8 w-8 opacity-35" />
                        <p className="font-medium text-foreground">No hay depósitos registrados</p>
                        <p className="mt-1 text-xs">Creá el primer depósito para comenzar a operar stock.</p>
                      </TableCell>
                    </TableRow>
                  )}
                  {warehouses.map((warehouse) => {
                    const stockTotal = batches
                      .filter((b) => b.warehouseId === warehouse.id)
                      .reduce((acc, b) => acc + b.quantity, 0);
                    const selected = selectedWarehouseId === warehouse.id;
                    return (
                      <TableRow
                        key={warehouse.id}
                        className={selected ? "bg-muted/40" : ""}
                        onClick={() => setSelectedWarehouseId(warehouse.id)}
                      >
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell>{TYPE_LABEL[warehouse.type]}</TableCell>
                        <TableCell className="text-right font-semibold">{stockTotal}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(warehouse);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(warehouse.id);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-0">
            {!selectedWarehouse ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Seleccioná un depósito para ver su stock completo.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                        <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                        <p className="font-medium text-foreground">Sin stock en {selectedWarehouse.name}</p>
                        <p className="mt-1 text-xs">Todavía no hay lotes cargados para este depósito.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedStock.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{medName(batch.medicationId)}</TableCell>
                        <TableCell className="font-mono text-xs">{batch.lot}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(batch.expiry)}</TableCell>
                        <TableCell className="text-right font-semibold">{batch.quantity}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Nuevo depósito" : "Editar depósito"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Ej: Farmacia Guardia"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((current) => ({ ...current, type: value as Warehouse["type"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTypes.includes("central") && <SelectItem value="central">Central</SelectItem>}
                  {allowedTypes.includes("interna") && <SelectItem value="interna">Interna</SelectItem>}
                  {allowedTypes.includes("ventas") && <SelectItem value="ventas">Ventas</SelectItem>}
                </SelectContent>
              </Select>
              {!hasCentral ? (
                <p className="text-xs text-muted-foreground">
                  Aún no hay depósito central: el primero debe ser de tipo Central.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ya existe un depósito central: nuevos depósitos deben ser Interna o Ventas.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancelar
            </Button>
            <Button onClick={saveWarehouse} disabled={saving}>
              {saving ? "Guardando..." : dialogMode === "add" ? "Crear depósito" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar depósito</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción elimina el depósito seleccionado. Si tiene movimientos o stock asociado, la base puede rechazar la eliminación.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

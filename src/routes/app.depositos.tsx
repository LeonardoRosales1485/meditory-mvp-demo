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
import { formatDate, medName, type TransferRequest, type Warehouse } from "@/lib/domain-types";
import { requireAdmin } from "@/lib/route-guards";
import { useStore } from "@/lib/store";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

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

const TERMINAL_TRANSFER_STATUS = new Set<TransferRequest["status"]>(["aceptado", "rechazado"]);

/** Reglas de negocio: no eliminar si hay stock o transferencias activas. */
function warehouseDeleteGuard(
  warehouseId: string,
  batchesList: { warehouseId: string; quantity: number }[],
  transfersList: TransferRequest[],
) {
  const stockTotal = batchesList
    .filter((b) => b.warehouseId === warehouseId)
    .reduce((acc, b) => acc + b.quantity, 0);
  const activeTransfers = transfersList.filter(
    (t) =>
      (t.fromWarehouseId === warehouseId || t.toWarehouseId === warehouseId) &&
      !TERMINAL_TRANSFER_STATUS.has(t.status),
  );
  const reasons: string[] = [];
  if (stockTotal > 0) {
    reasons.push(
      `Hay stock asociado: ${stockTotal.toLocaleString("es-AR")} u en total (suma de todos los lotes en este depósito).`,
    );
  }
  if (activeTransfers.length > 0) {
    reasons.push(
      `Hay ${activeTransfers.length} transferencia${activeTransfers.length === 1 ? "" : "s"} de stock activa${activeTransfers.length === 1 ? "" : "s"} (estado distinto de aceptada o rechazada) que incluye${activeTransfers.length === 1 ? "" : "n"} este depósito como origen o destino.`,
    );
  }
  return { ok: reasons.length === 0, reasons, stockTotal, activeCount: activeTransfers.length };
}

const TYPE_LABEL: Record<Warehouse["type"], string> = {
  central: "Central",
  interna: "Interna",
  ventas: "Ventas",
};

function WarehousesPage() {
  const session = useStore((s) => s.session);
  const warehousesFromStore = useStore((s) => s.warehouses);
  const warehouses = useMemo(
    () => warehousesFromStore.filter((w) => !w.deletedAt),
    [warehousesFromStore],
  );
  const batches = useStore((s) => s.batches);
  const transfers = useStore((s) => s.transfers);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addWarehouse = useStore((s) => s.addWarehouse);
  const updateWarehouse = useStore((s) => s.updateWarehouse);
  const deleteWarehouse = useStore((s) => s.deleteWarehouse);

  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-depositos");
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

  const pendingDeleteGuard = useMemo(
    () => (deleteConfirm ? warehouseDeleteGuard(deleteConfirm, batches, transfers) : null),
    [deleteConfirm, batches, transfers],
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
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Depósitos"
        description="Gestión de depósitos y visualización completa de stock por depósito."
        action={
          <Button onClick={openAdd} disabled={showLoading} className="w-full sm:w-auto">
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo depósito
          </Button>
        }
      />
      {isMobile && (
        <div className="mb-3">
          <MobileViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardContent className="px-0">
            {showLoading ? (
              <WorkspaceLoadingPlaceholder
                title="Cargando depósitos"
                description="Sincronizando depósitos de la Institución…"
              />
            ) : isMobile && viewMode === "cards" ? (
              <div className="space-y-3 p-3">
                {showEmpty && (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-35" />
                    <p className="font-medium text-foreground">No hay depósitos registrados</p>
                  </div>
                )}
                {warehouses.map((warehouse) => {
                  const stockTotal = batches
                    .filter((b) => b.warehouseId === warehouse.id)
                    .reduce((acc, b) => acc + b.quantity, 0);
                  return (
                    <Card key={warehouse.id}>
                      <CardContent className="space-y-2 p-4">
                        <button type="button" className="w-full text-left" onClick={() => setSelectedWarehouseId(warehouse.id)}>
                          <p className="text-sm font-semibold">{warehouse.name}</p>
                          <p className="text-xs text-muted-foreground">{TYPE_LABEL[warehouse.type]}</p>
                        </button>
                        <p className="text-xs text-muted-foreground">
                          Stock total: <span className="font-semibold text-foreground">{stockTotal}</span>
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(warehouse)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(warehouse.id)}>
                            Eliminar
                          </Button>
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
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
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
                        <TableCell className="hidden md:table-cell">{TYPE_LABEL[warehouse.type]}</TableCell>
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
            ) : isMobile && viewMode === "cards" ? (
              <div className="space-y-3 p-3">
                {selectedStock.length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-35" />
                    <p className="font-medium text-foreground">Sin stock en {selectedWarehouse.name}</p>
                  </div>
                ) : (
                  selectedStock.map((batch) => (
                    <Card key={batch.id}>
                      <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                        <p className="text-sm font-semibold text-foreground">{medName(batch.medicationId)}</p>
                        <p>Lote: {batch.lot}</p>
                        <p>Vencimiento: {formatDate(batch.expiry)}</p>
                        <p>Cantidad: <span className="font-semibold text-foreground">{batch.quantity} u</span></p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead className="hidden md:table-cell">Lote</TableHead>
                    <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
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
                        <TableCell className="hidden font-mono text-xs md:table-cell">{batch.lot}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(batch.expiry)}</TableCell>
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
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Solo podés eliminar un depósito si cumple todas estas condiciones:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-foreground font-medium">Sin stock:</span> la suma de unidades de todos los
                lotes en ese depósito debe ser <strong className="text-foreground">cero</strong>.
              </li>
              <li>
                <span className="text-foreground font-medium">Sin transferencias activas:</span> no debe figurar
                como origen o destino en ninguna transferencia cuyo estado sea distinto de{" "}
                <strong className="text-foreground">aceptada</strong> o{" "}
                <strong className="text-foreground">rechazada</strong> (incluye solicitadas, autorizadas, despachadas,
                en recepción, etc.).
              </li>
            </ul>
            {pendingDeleteGuard && !pendingDeleteGuard.ok ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive">
                <p className="font-medium text-foreground">Este depósito no cumple las condiciones:</p>
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
              onClick={confirmDelete}
              disabled={pendingDeleteGuard !== null && !pendingDeleteGuard.ok}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

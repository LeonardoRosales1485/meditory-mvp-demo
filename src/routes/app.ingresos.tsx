import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useMemo, useState } from "react";
import { Barcode, FlaskConical, Inbox, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { type ConcentrationUnit, formatDate, warehouseName, medName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { cn } from "@/lib/utils";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

const UNITS: ConcentrationUnit[] = ["mg", "mcg", "ml", "L", "g", "unidad"];

export const Route = createFileRoute("/app/ingresos")({
  beforeLoad: requireAdmin,
  component: Receipts,
});

const EMPTY_MED = { name: "", activeIngredient: "", concentrationValue: 0, concentrationUnit: "mg" as ConcentrationUnit, form: "" };

function Receipts() {
  const { warehouses } = useWarehouse();
  const movements = useStore((s) => s.movements);
  const medications = useStore((s) => s.medications);
  const catalogMedications = useMemo(() => medications.filter((m) => !m.deletedAt), [medications]);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const addReceipt = useStore((s) => s.addReceipt);
  const addMedication = useStore((s) => s.addMedication);
  const session = useStore((s) => s.session);

  // ── Ingreso form ──────────────────────────────────────────────────────────
  const [med, setMed] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [qty, setQty] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const centralWarehouse = warehouses.find((w) => w.type === "central") ?? null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedExpiry = expiry ? new Date(expiry) : null;
  if (selectedExpiry) selectedExpiry.setHours(0, 0, 0, 0);
  const expiryInvalid = !selectedExpiry || Number.isNaN(selectedExpiry.getTime()) || selectedExpiry <= today;

  // ── Nuevo medicamento dialog ───────────────────────────────────────────────
  const [medDialog, setMedDialog] = useState(false);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [savingMed, setSavingMed] = useState(false);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-ingresos");

  const recent = movements
    .filter((m) => m.type === "ingreso")
    .slice(0, 20);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitAttempted(true);
    if (!med || !lot || !expiry || !qty) {
      toast.error("Completá todos los campos");
      return;
    }
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(quantity) || quantity <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    try {
      setSubmitting(true);
      if (!centralWarehouse) {
        toast.error("No hay depósito central configurado.");
        return;
      }
      if (expiryInvalid) {
        toast.error("El vencimiento debe ser futuro.");
        return;
      }
      await addReceipt({ medicationId: med, warehouseId: centralWarehouse.id, lot, expiry: new Date(expiry).toISOString(), quantity });
      toast.success(`Ingreso registrado: ${quantity} u — Lote ${lot}`, {
        description: "Movimiento auditado y stock actualizado.",
      });
      setMed("");
      setLot("");
      setExpiry("");
      setQty("");
      setSubmitAttempted(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el ingreso.";
      toast.error("No se pudo registrar ingreso", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveMed(e: React.FormEvent) {
    e.preventDefault();
    if (!medForm.name.trim() || medForm.concentrationValue <= 0 || !medForm.form.trim()) {
      toast.error("Nombre, concentración y forma son obligatorios.");
      return;
    }
    setSavingMed(true);
    try {
      await addMedication({
        name: medForm.name.trim(),
        activeIngredient: medForm.activeIngredient.trim() || medForm.name.trim(),
        concentrationValue: medForm.concentrationValue,
        concentrationUnit: medForm.concentrationUnit,
        form: medForm.form.trim(),
        salePrice: 0,
      });
      toast.success(`Medicamento "${medForm.name}" creado.`);
      setMedForm(EMPTY_MED);
      setMedDialog(false);
    } finally {
      setSavingMed(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ingreso de mercadería"
        description={`Registrar nuevas compras. Workspace: ${session?.workspaceName ?? "—"}`}
        action={
          <Button variant="outline" onClick={() => setMedDialog(true)} disabled={workspaceDataLoading && catalogMedications.length === 0}>
            <FlaskConical className="mr-2 h-4 w-4" />
            Registrar nuevo medicamento
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* ── Ingreso form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> Nuevo ingreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Medicamento</Label>
                <Select value={med} onValueChange={setMed} disabled={workspaceDataLoading && catalogMedications.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogMedications.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.concentrationValue}{m.concentrationUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Depósito de ingreso</Label>
                <Input value={centralWarehouse ? centralWarehouse.name : "Sin depósito central"} disabled />
                <p className="text-xs text-muted-foreground">
                  Por regla de negocio, todos los ingresos se registran en el depósito central.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Lote</Label>
                  <div className="relative">
                    <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={lot}
                      onChange={(e) => setLot(e.target.value)}
                      placeholder="L-2026-..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className={cn(submitAttempted && expiryInvalid && "border-destructive focus-visible:ring-destructive")}
                />
                <p className={cn("text-xs", submitAttempted && expiryInvalid ? "text-destructive" : "text-muted-foreground")}>
                  Solo se aceptan fechas futuras.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className={cn("flex-1", submitting && "bg-muted text-muted-foreground hover:bg-muted")}
                  disabled={(workspaceDataLoading && catalogMedications.length === 0) || submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar ingreso"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Últimos ingresos ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos ingresos</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {isMobile && (
              <div className="px-3 pb-3">
                <MobileViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            {workspaceDataLoading && recent.length === 0 ? (
              <WorkspaceLoadingPlaceholder
                title="Cargando ingresos"
                description="Sincronizando movimientos con el servidor…"
              />
            ) : isMobile && viewMode === "cards" ? (
              <div className="space-y-3 p-3">
                {recent.length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    <Inbox className="mx-auto mb-2 h-8 w-8 opacity-35" />
                    <p className="font-medium text-foreground">No hay ingresos registrados</p>
                  </div>
                ) : (
                  recent.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-sm font-semibold">{medName(m.medicationId)}</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Depósito: {warehouseName(m.warehouseId)}</p>
                          <p>Lote: {m.lot ?? "—"}</p>
                          <p>Cantidad: <span className="font-semibold text-foreground">{m.quantity} u</span></p>
                          <p>Motivo: {m.reason}</p>
                          <p>Fecha: {formatDate(m.date)}</p>
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
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        <Inbox className="mx-auto mb-2 h-8 w-8 opacity-35" />
                        <p className="font-medium text-foreground">No hay ingresos registrados</p>
                        <p className="mt-1 max-w-md mx-auto text-xs">
                          Los movimientos de ingreso que registres en el formulario aparecerán aquí con medicamento, lote y depósito.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recent.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{medName(m.medicationId)}</TableCell>
                        <TableCell className="text-sm">{warehouseName(m.warehouseId)}</TableCell>
                        <TableCell className="font-mono text-xs">{m.lot ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{m.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.reason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.date)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Nuevo medicamento dialog ── */}
      <Dialog open={medDialog} onOpenChange={setMedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar nuevo medicamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveMed} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre comercial</Label>
              <Input
                placeholder="Ej: Paracetamol"
                value={medForm.name}
                onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Principio activo</Label>
              <Input
                placeholder="Ej: Paracetamol (vacío = igual al nombre)"
                value={medForm.activeIngredient}
                onChange={(e) => setMedForm((f) => ({ ...f, activeIngredient: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Concentración</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="flex-1"
                  placeholder="500"
                  value={medForm.concentrationValue || ""}
                  onChange={(e) => setMedForm((f) => ({ ...f, concentrationValue: Number(e.target.value) }))}
                />
                <Select
                  value={medForm.concentrationUnit}
                  onValueChange={(v) => setMedForm((f) => ({ ...f, concentrationUnit: v as ConcentrationUnit }))}
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
            <div className="space-y-1.5">
              <Label>Forma farmacéutica</Label>
              <Input
                placeholder="Ej: Comprimido"
                value={medForm.form}
                onChange={(e) => setMedForm((f) => ({ ...f, form: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setMedDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingMed}>
                {savingMed ? "Guardando..." : "Crear medicamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

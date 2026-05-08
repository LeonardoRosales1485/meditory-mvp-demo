import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Plus, Receipt, Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, medName } from "@/lib/domain-types";
import { stockFor, useStore } from "@/lib/store";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

export const Route = createFileRoute("/app/ventas")({
  component: SalesPage,
});

const PRICE_BY_NAME: Record<string, number> = {
  Paracetamol: 850, Ibuprofeno: 1200, Amoxicilina: 4200, Omeprazol: 1500,
  Salbutamol: 3800, Enalapril: 1100, Metformina: 3200, Diclofenac: 2400,
};

function SalesPage() {
  const session = useStore((s) => s.session);
  const allWarehouses = useStore((s) => s.warehouses);
  const sales = useStore((s) => s.sales);
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const addSale = useStore((s) => s.addSale);
  const salesWarehouses = allWarehouses.filter(
    (w) => w.workspaceId === session?.workspaceId && w.type === "ventas",
  );
  const salesWarehousesWithStock = salesWarehouses.filter((w) =>
    batches.some((b) => b.warehouseId === w.id && b.quantity > 0),
  );

  const [salesWarehouseId, setSalesWarehouseId] = useState(salesWarehousesWithStock[0]?.id ?? salesWarehouses[0]?.id ?? "");
  const [med, setMed] = useState("");
  const [qty, setQty] = useState("1");
  const [rxFile, setRxFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-ventas");

  const total = sales.reduce((acc, s) => acc + s.price * s.quantity, 0);
  const available = med ? stockFor(batches, med, salesWarehouseId) : 0;
  const medObj = medications.find((m) => m.id === med);
  const unitPrice = medObj ? (PRICE_BY_NAME[medObj.name] ?? 0) : 0;
  const medicationsForSelectedWarehouse = medications.filter((m) => stockFor(batches, m.id, salesWarehouseId) > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!salesWarehouseId) return toast.error("Seleccioná un depósito de venta.");
    if (!med) return toast.error("Seleccioná medicamento");
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(quantity) || quantity <= 0) return toast.error("Cantidad inválida");
    if (available < quantity) {
      const warehouseName = salesWarehouses.find((w) => w.id === salesWarehouseId)?.name ?? "depósito seleccionado";
      return toast.error("Stock insuficiente", { description: `Disponible: ${available} u en ${warehouseName}` });
    }
    const prescription = rxFile ? rxFile.name : undefined;
    try {
      setSubmitting(true);
      await addSale({ medicationId: med, warehouseId: salesWarehouseId, quantity, price: unitPrice, prescription });
      toast.success(`Venta registrada · ${quantity} u`, {
        description: rxFile ? `Receta ${rxFile.name} adjunta` : "Sin receta",
      });
      setMed("");
      setQty("1");
      setRxFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {salesWarehouses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No existen depósitos tipo ventas</p>
            <p className="mt-1">Creá al menos un depósito de tipo ventas para habilitar la operación de mostrador.</p>
          </CardContent>
        </Card>
      ) : salesWarehousesWithStock.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Ningún depósito tipo venta tiene stock en su inventario</p>
            <p className="mt-1">Ingresá o transferí stock a un depósito de ventas para poder registrar operaciones.</p>
          </CardContent>
        </Card>
      ) : (
      <>
      <PageHeader
        title="Ventas — Mostrador"
        description="Ventas disponibles solo desde depósitos de tipo ventas."
      />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> Nueva venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Depósito de venta</Label>
                <Select value={salesWarehouseId} onValueChange={(value) => {
                  setSalesWarehouseId(value);
                  setMed("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar depósito..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salesWarehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Medicamento</Label>
                <Select value={med} onValueChange={setMed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Buscar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {medicationsForSelectedWarehouse.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.concentrationValue}{m.concentrationUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {med && (
                  <p className="text-xs text-muted-foreground">
                    Stock disponible: <span className="font-medium text-foreground">{available} u</span> · Precio unitario: ${unitPrice}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rx-file">Receta (opcional)</Label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="rx-file"
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {rxFile ? "Cambiar archivo" : "Adjuntar archivo"}
                  </label>
                  <Input
                    id="rx-file"
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setRxFile(e.target.files?.[0] ?? null)}
                  />
                  {rxFile && (
                    <>
                      <span className="truncate text-xs text-muted-foreground" title={rxFile.name}>
                        {rxFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRxFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Quitar archivo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">PDF o imagen. Demo: solo se guarda el nombre.</p>
              </div>
              {med && qty && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  Total: <span className="font-semibold">${(unitPrice * (parseInt(qty, 10) || 0)).toLocaleString("es-AR")}</span>
                </div>
              )}
              <Button
                type="submit"
                className={`w-full ${submitting ? "bg-muted text-muted-foreground hover:bg-muted" : ""}`}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar venta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Ventas recientes
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">${total.toLocaleString("es-AR")}</span>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isMobile && (
              <div className="px-3 pb-3">
                <MobileViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            {isMobile && viewMode === "cards" ? (
              <div className="space-y-3 p-3">
                {sales.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="space-y-2 p-4">
                      <p className="text-sm font-semibold">{medName(s.medicationId)}</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Cantidad: {s.quantity} u</p>
                        <p>Importe: <span className="font-semibold text-foreground">${(s.price * s.quantity).toLocaleString("es-AR")}</span></p>
                        <p>Cajero: {s.cashier}</p>
                        <p>Receta: {s.prescription ?? "—"}</p>
                        <p>Fecha: {formatDate(s.date)}</p>
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
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="hidden md:table-cell">Receta</TableHead>
                  <TableHead className="hidden md:table-cell">Cajero</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{medName(s.medicationId)}</TableCell>
                    <TableCell className="text-right">{s.quantity}</TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">{s.prescription ?? "—"}</TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{s.cashier}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${(s.price * s.quantity).toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(s.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

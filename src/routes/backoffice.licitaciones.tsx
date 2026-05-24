import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Search, TrendingDown, TrendingUp, Package,
  Building2, Users, MessageSquare, Gavel, Eye, X, Check,
  RotateCcw, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import type {
  LowStockMedication, OverstockMedication, ProveedorRow,
  LicitacionRow, LicitacionItemRow, LicitacionOfertaRow,
  LicitacionHistorialRow, LicitacionEstado,
} from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/licitaciones")({
  component: LicitacionesPage,
});

const ESTADO_COLORS: Record<LicitacionEstado, string> = {
  borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  en_licitacion: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ofertas_recibidas: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  adjudicado: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  en_ejecucion: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const ESTADO_LABELS: Record<LicitacionEstado, string> = {
  borrador: "Borrador",
  en_licitacion: "En Licitación",
  ofertas_recibidas: "Ofertas Recibidas",
  adjudicado: "Adjudicado",
  en_ejecucion: "En Ejecución",
  completado: "Completado",
  cancelado: "Cancelado",
};

function LicitacionesPage() {
  const [tab, setTab] = useState("stock");
  const [lowStock, setLowStock] = useState<LowStockMedication[]>([]);
  const [overstock, setOverstock] = useState<OverstockMedication[]>([]);
  const [licitaciones, setLicitaciones] = useState<LicitacionRow[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<LicitacionItemRow[]>([]);
  const [detailOfertas, setDetailOfertas] = useState<LicitacionOfertaRow[]>([]);
  const [detailHistorial, setDetailHistorial] = useState<LicitacionHistorialRow[]>([]);
  const [selectedProveedores, setSelectedProveedores] = useState<ProveedorRow[]>([]);
  const [allMeds, setAllMeds] = useState<{ id: string; name: string; form: string; concentrationValue: number; concentrationUnit: string }[]>([]);

  async function loadAll() {
    setLoading(true);
    try {
      const rpc = await import("@/lib/server-rpc");

      const [ls, os, lics, provs, meds] = await Promise.all([
        rpc.licitacionesGetLowStockRpc().catch(() => []),
        rpc.licitacionesGetOverstockRpc().catch(() => []),
        rpc.licitacionesGetAllRpc().catch(() => []),
        rpc.licitacionesGetProveedoresRpc({ data: { soloActivos: true } }).catch(() => []),
        rpc.backofficeGetAllMedicationsRpc().catch(() => []),
      ]);

      setLowStock(ls as LowStockMedication[]);
      setOverstock(os as OverstockMedication[]);
      setLicitaciones(lics as LicitacionRow[]);
      setProveedores(provs as ProveedorRow[]);
      setAllMeds(meds as typeof allMeds);
    } catch (e) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function openDetail(lic: LicitacionRow) {
    setDetailId(lic.id);
    setDetailOpen(true);
    try {
      const rpc = await import("@/lib/server-rpc");
      const [items, ofertas, historial] = await Promise.all([
        rpc.licitacionesGetItemsRpc({ data: { licitacionId: lic.id } }),
        rpc.licitacionesGetOfertasRpc({ data: { licitacionId: lic.id } }),
        rpc.licitacionesGetHistorialRpc({ data: { licitacionId: lic.id } }),
      ]);
      setDetailItems(items as LicitacionItemRow[]);
      setDetailOfertas(ofertas as LicitacionOfertaRow[]);
      setDetailHistorial(historial as LicitacionHistorialRow[]);
    } catch {
      toast.error("Error al cargar detalle");
    }
  }

  async function handleCreateLicitacion(items: {
    medicationId: string; workspaceId: string; cantidad: number; justificacion: string;
  }[]) {
    try {
      const rpc = await import("@/lib/server-rpc");
      const nextNum = licitaciones.length + 1;
      const newLic = await rpc.licitacionesCreateRpc({
        data: {
          codigo: `LIC-${String(nextNum).padStart(4, "0")}`,
          titulo: `Licitación ${nextNum}`,
          descripcion: "Creada desde alerta de stock bajo",
          items: items.map((i) => ({
            medication_id: i.medicationId,
            workspace_id: i.workspaceId,
            cantidad_solicitada: i.cantidad,
            justificacion: i.justificacion,
          })),
        },
      });
      setLicitaciones((prev) => [newLic as LicitacionRow, ...prev]);
      setCreateOpen(false);
      toast.success("Licitación creada como borrador");
    } catch {
      toast.error("Error al crear licitación");
    }
  }

  async function handleCambiarEstado(licitacionId: string, nuevoEstado: LicitacionEstado) {
    try {
      const rpc = await import("@/lib/server-rpc");
      const updated = await rpc.licitacionesCambiarEstadoRpc({
        data: { licitacionId, nuevoEstado },
      }) as LicitacionRow;
      setLicitaciones((prev) => prev.map((l) => l.id === licitacionId ? updated : l));
      if (detailId === licitacionId) {
        loadDetailAgain(licitacionId);
      }
      toast.success(`Estado cambiado a ${ESTADO_LABELS[nuevoEstado]}`);
    } catch {
      toast.error("Error al cambiar estado");
    }
  }

  async function loadDetailAgain(id: string) {
    const rpc = await import("@/lib/server-rpc");
    const [items, ofertas, historial] = await Promise.all([
      rpc.licitacionesGetItemsRpc({ data: { licitacionId: id } }),
      rpc.licitacionesGetOfertasRpc({ data: { licitacionId: id } }),
      rpc.licitacionesGetHistorialRpc({ data: { licitacionId: id } }),
    ]);
    setDetailItems(items as LicitacionItemRow[]);
    setDetailOfertas(ofertas as LicitacionOfertaRow[]);
    setDetailHistorial(historial as LicitacionHistorialRow[]);
  }

  const totalDeficit = lowStock.reduce((s, i) => s + i.deficit, 0);
  const totalLoss = overstock.reduce((s, i) => s + i.lossAmount, 0);
  const activeLicitaciones = licitaciones.filter((l) => !["completado", "cancelado"].includes(l.estado));

  const medMap = new Map(allMeds.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Gavel className="text-primary" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Licitaciones</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de compras hospitalarias — Stock, licitaciones, ofertas y proveedores
            </p>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus size={16} /> Nueva Licitación
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Déficit Total</span>
            </div>
            <p className="text-2xl font-black">{totalDeficit.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{lowStock.length} medicamentos bajo stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Pérdida Sobre Stock</span>
            </div>
            <p className="text-2xl font-black">${totalLoss.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{overstock.length} medicamentos excedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package size={16} />
              <span className="text-xs font-medium">Licitaciones Activas</span>
            </div>
            <p className="text-2xl font-black">{activeLicitaciones.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{licitaciones.length} total creadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Building2 size={16} />
              <span className="text-xs font-medium">Proveedores</span>
            </div>
            <p className="text-2xl font-black">{proveedores.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Registrados en el sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="stock" className="gap-1.5 text-xs"><AlertCircle size={14} />Stock</TabsTrigger>
          <TabsTrigger value="licitaciones" className="gap-1.5 text-xs"><Gavel size={14} />Licitaciones</TabsTrigger>
          <TabsTrigger value="proveedores" className="gap-1.5 text-xs"><Building2 size={14} />Proveedores</TabsTrigger>
          <TabsTrigger value="asistente" className="gap-1.5 text-xs"><MessageSquare size={14} />Asistente</TabsTrigger>
        </TabsList>

        {/* Tab: Stock */}
        <TabsContent value="stock" className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando datos de stock...</p>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown size={14} className="text-red-500" />
                    Medicamentos con Bajo Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {lowStock.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin medicamentos con bajo stock</p>
                  ) : (
                    <LowStockTable
                      items={lowStock}
                      medMap={medMap}
                      onCreateLicitacion={(items) => {
                        setCreateOpen(true);
                        handleCreateLicitacion(items);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp size={14} className="text-amber-500" />
                    Medicamentos con Sobre Stock — Pérdida Estimada
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {overstock.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin medicamentos con sobre stock</p>
                  ) : (
                    <OverstockTable items={overstock} />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab: Licitaciones */}
        <TabsContent value="licitaciones" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{licitaciones.length} licitaciones registradas</p>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus size={14} /> Nueva
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {licitaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay licitaciones aún</p>
              ) : (
                <LicitacionesTable
                  items={licitaciones}
                  onOpenDetail={openDetail}
                  onCambiarEstado={handleCambiarEstado}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Proveedores */}
        <TabsContent value="proveedores" className="space-y-4">
          <ProveedoresPanel
            proveedores={proveedores}
            onRefresh={loadAll}
          />
        </TabsContent>

        {/* Tab: Asistente */}
        <TabsContent value="asistente" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Asistente de Licitaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Consultá al asistente sobre recomendaciones de compra, análisis de stock, o para que te ayude a crear una licitación.
              </p>
              <LicitacionesAssistant
                lowStock={lowStock}
                overstock={overstock}
                licitaciones={licitaciones}
                proveedores={proveedores}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear Licitación */}
      <CreateLicitacionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lowStock={lowStock}
        allMeds={allMeds}
        onConfirm={handleCreateLicitacion}
      />

      {/* Dialog: Detalle Licitación */}
      <DetailLicitacionDialog
        licitacionId={detailId}
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailId(null); }}
        licitaciones={licitaciones}
        items={detailItems}
        ofertas={detailOfertas}
        historial={detailHistorial}
        proveedores={proveedores}
        medMap={medMap}
        onCambiarEstado={handleCambiarEstado}
        onRefresh={loadDetailAgain}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function LowStockTable({ items, medMap, onCreateLicitacion }: {
  items: LowStockMedication[];
  medMap: Map<string, string>;
  onCreateLicitacion: (items: { medicationId: string; workspaceId: string; cantidad: number; justificacion: string }[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function createFromSelected() {
    const selectedItems = items.filter((i) => selected.has(i.medicationId + i.workspaceId));
    onCreateLicitacion(selectedItems.map((i) => ({
      medicationId: i.medicationId,
      workspaceId: i.workspaceId,
      cantidad: i.deficit,
      justificacion: `Stock bajo: actual ${i.currentStock}, mínimo ${i.minStock}, déficit ${i.deficit}`,
    })));
    setSelected(new Set());
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Button size="sm" onClick={createFromSelected} className="gap-1.5 h-7 text-xs">
            <Plus size={12} /> Crear licitación ({selected.size})
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead className="text-xs">Medicamento</TableHead>
            <TableHead className="text-xs">Hospital</TableHead>
            <TableHead className="text-xs text-right">Stock</TableHead>
            <TableHead className="text-xs text-right">Mínimo</TableHead>
            <TableHead className="text-xs text-right">Déficit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 50).map((item) => {
            const key = item.medicationId + item.workspaceId;
            return (
              <TableRow key={key}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    className="h-3.5 w-3.5"
                  />
                </TableCell>
                <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.workspaceName}</TableCell>
                <TableCell className="text-right text-sm">{item.currentStock.toLocaleString("es-AR")}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{item.minStock.toLocaleString("es-AR")}</TableCell>
                <TableCell className="text-right text-sm">
                  <Badge variant="destructive" className="text-xs">{item.deficit.toLocaleString("es-AR")}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function OverstockTable({ items }: { items: OverstockMedication[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Medicamento</TableHead>
          <TableHead className="text-xs">Hospital</TableHead>
          <TableHead className="text-xs text-right">Stock</TableHead>
          <TableHead className="text-xs text-right">Óptimo</TableHead>
          <TableHead className="text-xs text-right">Excedente</TableHead>
          <TableHead className="text-xs text-right">Precio</TableHead>
          <TableHead className="text-xs text-right">Pérdida Estimada</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 50).map((item) => (
          <TableRow key={item.medicationId + item.workspaceId}>
            <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{item.workspaceName}</TableCell>
            <TableCell className="text-right text-sm">{item.currentStock.toLocaleString("es-AR")}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">{item.optimalStock.toLocaleString("es-AR")}</TableCell>
            <TableCell className="text-right text-sm">
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs border-0">
                +{item.surplus.toLocaleString("es-AR")}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-sm">${item.salePrice.toLocaleString("es-AR")}</TableCell>
            <TableCell className="text-right text-sm text-red-600 font-medium">
              ${item.lossAmount.toLocaleString("es-AR")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LicitacionesTable({ items, onOpenDetail, onCambiarEstado }: {
  items: LicitacionRow[];
  onOpenDetail: (lic: LicitacionRow) => void;
  onCambiarEstado: (id: string, estado: LicitacionEstado) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Código</TableHead>
          <TableHead className="text-xs">Título</TableHead>
          <TableHead className="text-xs">Estado</TableHead>
          <TableHead className="text-xs">Creado</TableHead>
          <TableHead className="text-xs text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((lic) => (
          <TableRow key={lic.id}>
            <TableCell className="text-xs font-mono">{lic.codigo}</TableCell>
            <TableCell className="text-sm font-medium">{lic.titulo}</TableCell>
            <TableCell>
              <Badge className={`text-[10px] border-0 ${ESTADO_COLORS[lic.estado]}`}>
                {ESTADO_LABELS[lic.estado]}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(lic.fecha_creacion).toLocaleDateString("es-AR")}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onOpenDetail(lic)}>
                  <Eye size={14} />
                </Button>
                {lic.estado === "borrador" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => onCambiarEstado(lic.id, "en_licitacion")}>
                    <RotateCcw size={14} />
                  </Button>
                )}
                {lic.estado !== "completado" && lic.estado !== "cancelado" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => onCambiarEstado(lic.id, "cancelado")}>
                    <X size={14} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProveedoresPanel({ proveedores, onRefresh }: {
  proveedores: ProveedorRow[];
  onRefresh: () => void;
}) {
  const [searchProv, setSearchProv] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cuit, setCuit] = useState("");
  const [direccion, setDireccion] = useState("");

  const filtered = proveedores.filter(
    (p) => p.nombre.toLowerCase().includes(searchProv.toLowerCase()),
  );

  async function handleCreateProveedor() {
    if (!nombre.trim()) return;
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.licitacionesCreateProveedorRpc({
        data: { nombre: nombre.trim(), contacto, telefono, email, cuit, direccion },
      });
      toast.success("Proveedor creado");
      setNewOpen(false);
      setNombre(""); setContacto(""); setTelefono(""); setEmail(""); setCuit(""); setDireccion("");
      onRefresh();
    } catch {
      toast.error("Error al crear proveedor");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedor..."
            value={searchProv}
            onChange={(e) => setSearchProv(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus size={14} /> Nuevo Proveedor
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin proveedores</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs">Contacto</TableHead>
                  <TableHead className="text-xs">Teléfono</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">CUIT</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.contacto}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.telefono}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.cuit}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${p.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">CUIT</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateProveedor} disabled={!nombre.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateLicitacionDialog({ open, onOpenChange, lowStock, allMeds, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lowStock: LowStockMedication[];
  allMeds: { id: string; name: string }[];
  onConfirm: (items: { medicationId: string; workspaceId: string; cantidad: number; justificacion: string }[]) => void;
}) {
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) {
      setSelectedMeds(new Set());
      setCantidades({});
    }
  }, [open]);

  function toggle(id: string) {
    setSelectedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const items = lowStock
      .filter((i) => selectedMeds.has(i.medicationId + i.workspaceId))
      .map((i) => {
        const key = i.medicationId + i.workspaceId;
        return {
          medicationId: i.medicationId,
          workspaceId: i.workspaceId,
          cantidad: cantidades[key] ?? i.deficit,
          justificacion: `Stock bajo: actual ${i.currentStock}, mínimo ${i.minStock}, déficit ${i.deficit}`,
        };
      });
    onConfirm(items);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Licitación</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Seleccioná los medicamentos con bajo stock para incluir en la licitación.</p>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay medicamentos con bajo stock</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-xs">Medicamento</TableHead>
                  <TableHead className="text-xs">Hospital</TableHead>
                  <TableHead className="text-xs text-right">Déficit</TableHead>
                  <TableHead className="text-xs text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((item) => {
                  const key = item.medicationId + item.workspaceId;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedMeds.has(key)}
                          onChange={() => toggle(key)}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.workspaceName}</TableCell>
                      <TableCell className="text-right text-sm">{item.deficit.toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="h-7 w-20 text-xs text-right"
                          value={cantidades[key] ?? item.deficit}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          min={1}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={confirm} disabled={selectedMeds.size === 0}>
            Crear Licitación ({selectedMeds.size} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailLicitacionDialog({ licitacionId, open, onOpenChange, licitaciones, items, ofertas, historial, proveedores, medMap, onCambiarEstado, onRefresh }: {
  licitacionId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  licitaciones: LicitacionRow[];
  items: LicitacionItemRow[];
  ofertas: LicitacionOfertaRow[];
  historial: LicitacionHistorialRow[];
  proveedores: ProveedorRow[];
  medMap: Map<string, string>;
  onCambiarEstado: (id: string, estado: LicitacionEstado) => void;
  onRefresh: (id: string) => void;
}) {
  const lic = licitaciones.find((l) => l.id === licitacionId);
  if (!lic) return null;

  const provMap = new Map(proveedores.map((p) => [p.id, p.nombre]));
  const ofertasAdjudicadas = ofertas.filter((o) => o.adjudicado);

  const TRANSICIONES: { desde: LicitacionEstado[]; hacia: LicitacionEstado; label: string; variant?: "default" | "destructive" }[] = [
    { desde: ["borrador"], hacia: "en_licitacion", label: "Publicar" },
    { desde: ["en_licitacion"], hacia: "ofertas_recibidas", label: "Recibir ofertas" },
    { desde: ["ofertas_recibidas"], hacia: "adjudicado", label: "Adjudicar" },
    { desde: ["adjudicado"], hacia: "en_ejecucion", label: "Iniciar ejecución" },
    { desde: ["en_ejecucion"], hacia: "completado", label: "Completar" },
    { desde: ["borrador", "en_licitacion", "ofertas_recibidas", "adjudicado", "en_ejecucion"], hacia: "cancelado", label: "Cancelar", variant: "destructive" },
  ];

  const accionesDisponibles = TRANSICIONES.filter((t) => t.desde.includes(lic.estado));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lic.codigo} — {lic.titulo}
            <Badge className={`text-[10px] border-0 ${ESTADO_COLORS[lic.estado]}`}>
              {ESTADO_LABELS[lic.estado]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Acciones */}
          {accionesDisponibles.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {accionesDisponibles.map((accion) => (
                <Button
                  key={accion.hacia}
                  size="sm"
                  variant={accion.variant ?? "default"}
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    onCambiarEstado(lic.id, accion.hacia);
                    onRefresh(lic.id);
                  }}
                >
                  {accion.hacia === "cancelado" ? <X size={12} /> : <Check size={12} />}
                  {accion.label}
                </Button>
              ))}
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="text-xs font-semibold mb-2">Items solicitados</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Medicamento</TableHead>
                  <TableHead className="text-xs text-right">Solicitado</TableHead>
                  <TableHead className="text-xs text-right">Adjudicado</TableHead>
                  <TableHead className="text-xs text-right">Precio Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{medMap.get(item.medication_id) ?? item.medication_id}</TableCell>
                    <TableCell className="text-right text-sm">{item.cantidad_solicitada.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right text-sm">{item.cantidad_adjudicada > 0 ? item.cantidad_adjudicada.toLocaleString("es-AR") : "—"}</TableCell>
                    <TableCell className="text-right text-sm">${item.precio_unitario_estimado.toLocaleString("es-AR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Ofertas */}
          <div>
            <h4 className="text-xs font-semibold mb-2">Ofertas recibidas</h4>
            {ofertas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ofertas aún</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Proveedor</TableHead>
                    <TableHead className="text-xs text-right">Monto Total</TableHead>
                    <TableHead className="text-xs text-right">Plazo (días)</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofertas.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{provMap.get(o.proveedor_id) ?? o.proveedor_id}</TableCell>
                      <TableCell className="text-right text-sm font-medium">${o.monto_total.toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-right text-sm">{o.plazo_entrega_dias}</TableCell>
                      <TableCell>
                        {o.adjudicado ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px] border-0">Adjudicado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Historial */}
          <div>
            <h4 className="text-xs font-semibold mb-2">Historial de cambios</h4>
            {historial.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin cambios registrados</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {historial.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(h.fecha_cambio).toLocaleString("es-AR")}
                    </span>
                    <Badge className={`text-[9px] border-0 ${h.estado_anterior ? ESTADO_COLORS[h.estado_anterior] : "bg-gray-100"}`}>
                      {h.estado_anterior ? ESTADO_LABELS[h.estado_anterior] : "—"}
                    </Badge>
                    <span className="text-muted-foreground/60">→</span>
                    <Badge className={`text-[9px] border-0 ${ESTADO_COLORS[h.estado_nuevo]}`}>
                      {ESTADO_LABELS[h.estado_nuevo]}
                    </Badge>
                    {h.usuario && <span className="text-muted-foreground/60">por {h.usuario}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones */}
          {lic.observaciones && (
            <div>
              <h4 className="text-xs font-semibold mb-1">Observaciones</h4>
              <p className="text-xs text-muted-foreground">{lic.observaciones}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LicitacionesAssistant({ lowStock, overstock, licitaciones, proveedores }: {
  lowStock: LowStockMedication[];
  overstock: OverstockMedication[];
  licitaciones: LicitacionRow[];
  proveedores: ProveedorRow[];
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Soy el asistente de licitaciones. Puedo ayudarte con recomendaciones de compra, análisis de stock, y creación de licitaciones. ¿En qué puedo ayudarte?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const systemPrompt = `Eres un asistente especializado en licitaciones de compra de medicamentos hospitalarios.

Contexto actual:
- Medicamentos con bajo stock (déficit total): ${lowStock.length} items, déficit total: ${lowStock.reduce((s, i) => s + i.deficit, 0)} unidades
- Medicamentos con sobre stock: ${overstock.length} items, pérdida total estimada: $${overstock.reduce((s, i) => s + i.lossAmount, 0)}
- Licitaciones activas: ${licitaciones.filter((l) => !["completado", "cancelado"].includes(l.estado)).length}
- Proveedores registrados: ${proveedores.length}

Podés ayudar a:
1. Analizar qué medicamentos necesitan licitación urgente
2. Sugerir cantidades óptimas para licitar
3. Explicar el proceso de licitación
4. Recomendar acciones según el estado actual del stock

Respondé de forma clara y concisa.`;

    try {
      const rpc = await import("@/lib/server-rpc");
      const res = await rpc.aiChatRpc({
        data: {
          model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.filter((m) => m.role !== "system"),
            { role: "user", content: userMsg },
          ],
        },
      }) as { content: string; tool_calls: unknown[] };
      setMessages((prev) => [...prev, { role: "assistant", content: res.content || "No pude procesar la solicitud." }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar con el asistente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Pensando...</div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej: ¿Qué medicamentos necesitan licitarse con urgencia?"
          className="text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={loading}
        />
        <Button size="sm" onClick={send} disabled={loading || !input.trim()}>Enviar</Button>
      </div>
    </div>
  );
}

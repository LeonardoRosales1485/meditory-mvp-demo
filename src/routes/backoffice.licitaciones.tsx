import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Search, TrendingDown, TrendingUp, Package,
  Building2, Users, MessageSquare, Gavel, Eye, X, Check,
  RotateCcw, AlertCircle, Filter, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantTools, parseCreateLicitacionArgs, parseFindSimilarLicitacionesArgs, parseCreateTransferArgs } from "@/lib/assistant-tools";
import { useStore } from "@/lib/store";
import DownloadLicitacionesPdf from "@/components/pdf-licitaciones-report";
import DownloadTransferenciasPdf from "@/components/pdf-transferencias-report";
import type {
  LowStockMedication, OverstockMedication, ProveedorRow,
  LicitacionRow, LicitacionItemRow, LicitacionOfertaRow,
  LicitacionHistorialRow, LicitacionEstado,
} from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/licitaciones")({
  component: LicitacionesPage,
});

const TRANSFER_STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  autorizado: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  despachado: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  recibir: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  recibido: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  aceptado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  autorizado: "Autorizado",
  despachado: "Despachado",
  recibir: "Pendiente Recepción",
  recibido: "Recibido",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

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
  const [selectedWs, setSelectedWs] = useState<string>("__all__");
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [searchLic, setSearchLic] = useState("");
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; workspace_id: string }[]>([]);
  const [searchTransfer, setSearchTransfer] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const rpc = await import("@/lib/server-rpc");

      const [ls, os, lics, provs, meds, wss, rt] = await Promise.all([
        rpc.licitacionesGetLowStockRpc().catch(() => []),
        rpc.licitacionesGetOverstockRpc().catch(() => []),
        rpc.licitacionesGetAllRpc().catch(() => []),
        rpc.licitacionesGetProveedoresRpc({ data: { soloActivos: true } }).catch(() => []),
        rpc.backofficeGetAllMedicationsRpc().catch(() => []),
        rpc.licitacionesGetWorkspacesRpc().catch(() => []),
        rpc.backofficeGetRealtimeDataRpc({ data: {} }).catch(() => ({ transfers: [], warehouses: [] })),
      ]);

      setLowStock(ls as LowStockMedication[]);
      setOverstock(os as OverstockMedication[]);
      setLicitaciones(lics as LicitacionRow[]);
      setProveedores(provs as ProveedorRow[]);
      setAllMeds(meds as typeof allMeds);
      setWorkspaces(wss as { id: string; name: string }[]);
      const rtData = rt as { transfers: any[]; warehouses: { id: string; name: string; workspace_id: string }[] };
      if (rtData.transfers.length === 0 && (meds as typeof allMeds).length > 0) {
        await rpc.backofficeSeedTransfersRpc();
        const reload = await rpc.backofficeGetRealtimeDataRpc({ data: {} }) as { transfers: any[]; warehouses: any[] };
        setTransfers(reload.transfers);
        setWarehouses(reload.warehouses);
      } else {
        setTransfers(rtData.transfers);
        setWarehouses(rtData.warehouses);
      }
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
      }) as LicitacionRow | undefined;
      if (!updated) {
        toast.error("Error al cambiar estado: el servidor no devolvió datos");
        return;
      }
      setLicitaciones((prev) => prev.map((l) => (l.id === licitacionId ? updated : l)));
      if (detailId === licitacionId) {
        await loadDetailAgain(licitacionId);
      }
      toast.success(`Estado cambiado a ${ESTADO_LABELS[nuevoEstado]}`);
    } catch (e) {
      console.error("Error cambiando estado:", e);
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

  const selectedWsName = selectedWs === "__all__" ? null : workspaces.find((ws) => ws.id === selectedWs)?.name ?? null;

  const filteredLowStock = useMemo(() => {
    if (selectedWs === "__all__") return lowStock;
    return lowStock.filter((i) => i.workspaceId === selectedWs);
  }, [lowStock, selectedWs]);

  const filteredOverstock = useMemo(() => {
    if (selectedWs === "__all__") return overstock;
    return overstock.filter((i) => i.workspaceId === selectedWs);
  }, [overstock, selectedWs]);

  const filteredLicitaciones = useMemo(() => {
    let list = licitaciones;
    if (selectedWs !== "__all__") {
      list = list.filter((l) => l.workspace_ids?.includes(selectedWs));
    }
    if (searchLic) {
      const q = searchLic.toLowerCase();
      list = list.filter((l) =>
        l.codigo.toLowerCase().includes(q) ||
        l.titulo.toLowerCase().includes(q) ||
        l.creado_por.toLowerCase().includes(q)
      );
    }
    return list;
  }, [licitaciones, selectedWs, searchLic]);

  const totalDeficit = filteredLowStock.reduce((s, i) => s + i.deficit, 0);
  const totalLoss = filteredOverstock.reduce((s, i) => s + i.lossAmount, 0);
  const activeLicitaciones = filteredLicitaciones.filter((l) => !["completado", "cancelado"].includes(l.estado));
  const totalTransfers = transfers.length;
  const activeTransfers = transfers.filter((t) => !["recibido", "rechazado"].includes(t.status)).length;

  const medMap = new Map(allMeds.map((m) => [m.id, m.name]));
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Gavel className="text-primary" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Licitaciones</h1>
            <p className="text-sm text-muted-foreground">
              {selectedWs === "__all__" ? "Visión consolidada de todos los hospitales" : selectedWsName} — Stock, licitaciones, ofertas y proveedores
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedWs} onValueChange={setSelectedWs}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los hospitales</SelectItem>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus size={16} /> Nueva Licitación
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setTab("stock")}
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Déficit Total</span>
            </div>
            <p className="text-2xl font-black">{totalDeficit.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredLowStock.length} medicamentos bajo stock</p>
          </CardContent>
        </Card>
        <Card
          onClick={() => setTab("stock")}
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Pérdida Sobre Stock</span>
            </div>
            <p className="text-2xl font-black">${totalLoss.toLocaleString("es-AR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredOverstock.length} medicamentos excedidos</p>
          </CardContent>
        </Card>
        <Card
          onClick={() => setTab("licitaciones")}
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package size={16} />
              <span className="text-xs font-medium">Licitaciones Activas</span>
            </div>
            <p className="text-2xl font-black">{activeLicitaciones.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredLicitaciones.length} total creadas</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <ArrowLeftRight size={16} />
              <span className="text-xs font-medium">Transferencias</span>
            </div>
            <p className="text-2xl font-black">{activeTransfers} <span className="text-base font-normal text-muted-foreground">/ {totalTransfers}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">en curso / total</p>
          </CardContent>
        </Card>
        <Card
          onClick={() => setTab("proveedores")}
          className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
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
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="stock" className="gap-1.5 text-xs"><AlertCircle size={14} />Stock</TabsTrigger>
          <TabsTrigger value="licitaciones" className="gap-1.5 text-xs"><Gavel size={14} />Licitaciones</TabsTrigger>
          <TabsTrigger value="proveedores" className="gap-1.5 text-xs"><Building2 size={14} />Proveedores</TabsTrigger>
          <TabsTrigger value="transferencias" className="gap-1.5 text-xs"><ArrowLeftRight size={14} />Transferencias</TabsTrigger>
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
                  {filteredLowStock.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin medicamentos con bajo stock</p>
                  ) : (
                    <LowStockTable
                      items={filteredLowStock}
                      medMap={medMap}
                      onCreateLicitacion={handleCreateLicitacion}
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
                  {filteredOverstock.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin medicamentos con sobre stock</p>
                  ) : (
                    <OverstockTable
                      items={filteredOverstock}
                      medMap={medMap}
                      onCreateLicitacion={handleCreateLicitacion}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab: Licitaciones */}
        <TabsContent value="licitaciones" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredLicitaciones.length} licitaciones registradas</p>
            <div className="flex items-center gap-2">
              <DownloadLicitacionesPdf
                lowStock={filteredLowStock}
                overstock={filteredOverstock}
                licitaciones={filteredLicitaciones}
                proveedores={proveedores}
                medMap={medMap}
                wsName={selectedWsName}
              />
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus size={14} /> Nueva
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, título o creador..."
                value={searchLic}
                onChange={(e) => setSearchLic(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {filteredLicitaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{searchLic ? "Sin resultados" : "No hay licitaciones aún"}</p>
              ) : (
                <LicitacionesTable
                  items={filteredLicitaciones}
                  onOpenDetail={openDetail}
                  onCambiarEstado={handleCambiarEstado}
                  lowStock={filteredLowStock}
                  overstock={filteredOverstock}
                  proveedores={proveedores}
                  medMap={medMap}
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

        {/* Tab: Transferencias */}
        <TabsContent value="transferencias" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{transfers.length} transferencias registradas</p>
            <DownloadTransferenciasPdf
              transfers={transfers}
              medMap={medMap}
              whMap={whMap}
              wsName={selectedWsName}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, medicamento, origen o destino..."
                value={searchTransfer}
                onChange={(e) => setSearchTransfer(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {(() => {
                const tData = transfers as any[];
                const wsMap = new Map(workspaces.map((w) => [w.id, w.name]));
                const whMap = new Map(warehouses.map((w) => [w.id, w.name]));
                const filtered = tData
                  .filter((t) => {
                    if (!searchTransfer) return true;
                    const q = searchTransfer.toLowerCase();
                    return [t.transfer_code, t.medication_id, t.from_warehouse_id, t.to_warehouse_id, t.status]
                      .some((v) => String(v ?? "").toLowerCase().includes(q));
                  })
                  .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
                if (filtered.length === 0) {
                  return <p className="text-sm text-muted-foreground py-8 text-center">{searchTransfer ? "Sin resultados" : "No hay transferencias aún"}</p>;
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Medicamento</TableHead>
                        <TableHead className="text-xs">Origen</TableHead>
                        <TableHead className="text-xs">Destino</TableHead>
                        <TableHead className="text-xs">Cant.</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow key={t.id} className="text-xs">
                          <TableCell className="font-mono">{t.transfer_code ?? t.id.slice(0, 8)}</TableCell>
                          <TableCell>{medMap.get(t.medication_id) ?? t.medication_id?.slice(0, 8)}</TableCell>
                          <TableCell>{whMap.get(t.from_warehouse_id) ?? t.from_warehouse_id?.slice(0, 8)}</TableCell>
                          <TableCell>{whMap.get(t.to_warehouse_id) ?? t.to_warehouse_id?.slice(0, 8)}</TableCell>
                          <TableCell>{t.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TRANSFER_STATUS_COLORS[t.status] ?? ""}`}>
                              {TRANSFER_STATUS_LABELS[t.status] ?? t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.date ? new Date(t.date).toLocaleDateString("es-AR") : "-"}</TableCell>
                          <TableCell className="text-right">
                            <DownloadTransferenciasPdf
                              transfers={[t]}
                              medMap={medMap}
                              whMap={whMap}
                              wsName={t.transfer_code ?? t.id.slice(0, 8)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
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
                lowStock={filteredLowStock}
                overstock={filteredOverstock}
                licitaciones={filteredLicitaciones}
                proveedores={proveedores}
                onCreateLicitacion={async (data) => {
                  const rpc = await import("@/lib/server-rpc");
                  const newLic = await rpc.licitacionesCreateRpc({ data }) as LicitacionRow;
                  setLicitaciones((prev) => [newLic, ...prev]);
                  return newLic;
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear Licitación */}
      <CreateLicitacionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lowStock={filteredLowStock}
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
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function StockTableToolbar({ selectedCount, totalCount, onSelectAll, onDeselectAll, onCreateLicitacion }: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateLicitacion: () => void;
}) {
  if (selectedCount === 0 && totalCount === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      {totalCount > 0 && (
        <>
          <Button size="sm" variant="ghost" onClick={onSelectAll} className="h-7 text-xs gap-1">
            <Check size={12} /> Seleccionar todo
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeselectAll} className="h-7 text-xs gap-1">
            <X size={12} /> Deseleccionar todo
          </Button>
        </>
      )}
      {selectedCount > 0 && (
        <Button size="sm" onClick={onCreateLicitacion} className="gap-1.5 h-7 text-xs ml-auto">
          <Plus size={12} /> Crear licitación ({selectedCount})
        </Button>
      )}
    </div>
  );
}

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

  function selectAll() {
    setSelected(new Set(items.map((i) => i.medicationId + i.workspaceId)));
  }

  function deselectAll() {
    setSelected(new Set());
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
      <StockTableToolbar
        selectedCount={selected.size}
        totalCount={items.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onCreateLicitacion={createFromSelected}
      />
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

function OverstockTable({ items, medMap, onCreateLicitacion }: {
  items: OverstockMedication[];
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

  function selectAll() {
    setSelected(new Set(items.map((i) => i.medicationId + i.workspaceId)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function createFromSelected() {
    const selectedItems = items.filter((i) => selected.has(i.medicationId + i.workspaceId));
    onCreateLicitacion(selectedItems.map((i) => ({
      medicationId: i.medicationId,
      workspaceId: i.workspaceId,
      cantidad: Math.max(i.surplus, 100),
      justificacion: `Sobre stock: actual ${i.currentStock}, óptimo ${i.optimalStock}, excedente ${i.surplus}, pérdida estimada $${i.lossAmount}`,
    })));
    setSelected(new Set());
  }

  return (
    <div>
      <StockTableToolbar
        selectedCount={selected.size}
        totalCount={items.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onCreateLicitacion={createFromSelected}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function LicitacionesTable({ items, onOpenDetail, onCambiarEstado, lowStock, overstock, proveedores, medMap }: {
  items: LicitacionRow[];
  onOpenDetail: (lic: LicitacionRow) => void;
  onCambiarEstado: (id: string, estado: LicitacionEstado) => void;
  lowStock: LowStockMedication[];
  overstock: OverstockMedication[];
  proveedores: ProveedorRow[];
  medMap: Map<string, string>;
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
                <DownloadLicitacionesPdf
                  lowStock={lowStock.filter((i) => lic.workspace_ids?.includes(i.workspaceId))}
                  overstock={overstock.filter((i) => lic.workspace_ids?.includes(i.workspaceId))}
                  licitaciones={[lic]}
                  proveedores={proveedores}
                  medMap={medMap}
                  wsName={lic.codigo}
                />
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
    (p) => {
      if (!searchProv) return true;
      const q = searchProv.toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.contacto.toLowerCase().includes(q) ||
        p.telefono.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.cuit.toLowerCase().includes(q) ||
        p.direccion.toLowerCase().includes(q)
      );
    },
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
  const [searchMed, setSearchMed] = useState("");
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  const filteredLowStock = searchMed
    ? lowStock.filter((i) =>
        i.medicationName.toLowerCase().includes(searchMed.toLowerCase()) ||
        i.workspaceName.toLowerCase().includes(searchMed.toLowerCase())
      )
    : lowStock;

  useEffect(() => {
    if (!open) {
      setSearchMed("");
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
    const items = filteredLowStock
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
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por medicamento u hospital..."
              value={searchMed}
              onChange={(e) => setSearchMed(e.target.value)}
              className="pl-8 text-sm h-8"
            />
          </div>
          {filteredLowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{searchMed ? "Sin resultados" : "No hay medicamentos con bajo stock"}</p>
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
                {filteredLowStock.map((item) => {
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

function DetailLicitacionDialog({ licitacionId, open, onOpenChange, licitaciones, items, ofertas, historial, proveedores, medMap, onCambiarEstado }: {
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
                  onClick={() => onCambiarEstado(lic.id, accion.hacia)}
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

function LicitacionesAssistant({ lowStock, overstock, licitaciones, proveedores, onCreateLicitacion }: {
  lowStock: LowStockMedication[];
  overstock: OverstockMedication[];
  licitaciones: LicitacionRow[];
  proveedores: ProveedorRow[];
  onCreateLicitacion: (data: {
    codigo: string;
    titulo: string;
    descripcion: string;
    items: Array<{
      medication_id: string;
      workspace_id: string;
      cantidad_solicitada: number;
      justificacion: string;
    }>;
  }) => Promise<LicitacionRow>;
}) {
  const storedMessages = useStore((s) => s.chatMessages);
  const setStoredMessages = useStore((s) => s.setChatMessages);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(() =>
    storedMessages.length > 0
      ? storedMessages as { role: string; content: string }[]
      : [{ role: "assistant", content: "Soy el asistente de licitaciones. Puedo ayudarte con recomendaciones de compra, análisis de stock, y creación de licitaciones. ¿En qué puedo ayudarte?" }],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persistir mensajes de texto al store
  useEffect(() => {
    const textMessages = messages
      .filter((m): m is { role: "user" | "assistant"; content: string } =>
        m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    setStoredMessages(textMessages);
  }, [messages, setStoredMessages]);

  function buildSystemPrompt(): string {
    const lowStockSummary = lowStock.slice(0, 30).map((i) =>
      `- ${i.medicationName} (${i.workspaceName}): stock ${i.currentStock}, mínimo ${i.minStock}, déficit ${i.deficit}`
    ).join("\n");
    const overstockSummary = overstock.slice(0, 20).map((i) =>
      `- ${i.medicationName} (${i.workspaceName}): stock ${i.currentStock}, óptimo ${i.optimalStock}, excedente ${i.surplus}`
    ).join("\n");
    const activeLics = licitaciones.filter((l) => !["completado", "cancelado"].includes(l.estado));
    const activeLicSummary = activeLics.length > 0
      ? activeLics.map((l) => `- ${l.codigo}: ${l.titulo} (${l.estado})`).join("\n")
      : "Ninguna";
    return `Eres un asistente especializado en licitaciones de compra de medicamentos hospitalarios.

Contexto actual:
- Medicamentos con bajo stock: ${lowStock.length} items
${lowStockSummary}
- Medicamentos con sobre stock: ${overstock.length} items
${overstockSummary}
- Licitaciones activas (no completadas ni canceladas):
${activeLicSummary}
- Proveedores registrados: ${proveedores.length}

Reglas:
1. Cuando el usuario pida crear una licitación, guialo paso a paso para definir: título, medicamentos a incluir, cantidades y justificación.
2. ANTES de crear una licitación, usá la herramienta find_similar_licitaciones para verificar si ya existe una licitación activa que cubra los mismos medicamentos. Si existe, informale al usuario.
3. Una vez que tengas todos los datos acordados y hayas verificado que no hay duplicados, usá la herramienta create_licitacion para crearla automáticamente.
4. Siempre confirmá con el usuario antes de crear.
5. También podés crear transferencias de stock entre depósitos (mismo hospital u hospitales distintos) usando la tool create_transfer cuando el usuario lo solicite y tengas los datos necesarios (medicationId, sourceBatchId, fromWarehouseId, toWarehouseId, quantity).
6. Respondé de forma clara y concisa.`;
  }

  async function callLlm(
    history: { role: string; content: string }[],
    systemPrompt: string,
  ): Promise<{ content: string; tool_calls: { id: string; type: string; function: { name: string; arguments: string } }[] }> {
    const rpc = await import("@/lib/server-rpc");
    return rpc.aiChatRpc({
      data: {
        model: "deepseek-v4-flash-free",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.filter((m) => m.role !== "system"),
        ],
        tools: assistantTools,
      },
    }) as Promise<{ content: string; tool_calls: { id: string; type: string; function: { name: string; arguments: string } }[] }>;
  }

  async function send() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const systemPrompt = buildSystemPrompt();

    try {
      await processLlmCall(
        [...messages, { role: "user", content: userMsg }],
        systemPrompt,
        0,
      );
    } finally {
      setLoading(false);
    }
  }

  async function processLlmCall(
    history: { role: string; content: string }[],
    systemPrompt: string,
    depth: number,
  ) {
    if (depth > 3) {
      setMessages((prev) => [...prev, { role: "assistant", content: "No pude completar la operación. Intentá de nuevo." }]);
      return;
    }

    const rpc = await import("@/lib/server-rpc");
    let res: { content: string; tool_calls: { id: string; type: string; function: { name: string; arguments: string } }[] };

    try {
      res = await callLlm(history, systemPrompt);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar con el asistente." }]);
      return;
    }

    if (res.tool_calls && res.tool_calls.length > 0) {
      // Mostrar el texto del LLM antes de procesar herramientas
      let updatedHistory = history;
      if (res.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
        updatedHistory = [...updatedHistory, { role: "assistant", content: res.content }];
      }

      const toolResults: { role: string; content: string }[] = [];

      for (const tc of res.tool_calls) {
        if (tc.function.name === "create_licitacion") {
          const args = parseCreateLicitacionArgs(JSON.parse(tc.function.arguments));
          if (!args) {
            setMessages((prev) => [...prev, { role: "assistant", content: "❌ Parámetros inválidos para crear licitación." }]);
            continue;
          }
          try {
            const created = await onCreateLicitacion(args as any);
            const msg = `✅ Licitación **${created.codigo}** creada exitosamente como borrador.\n\n${created.titulo}\n${created.descripcion}`;
            setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
            return;
          } catch {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "❌ Ocurrió un error al crear la licitación. Intentalo de nuevo.",
            }]);
          }
        } else if (tc.function.name === "find_similar_licitaciones") {
          const args = parseFindSimilarLicitacionesArgs(JSON.parse(tc.function.arguments));
          if (!args) {
            toolResults.push({ role: "assistant", content: "❌ Parámetros inválidos para buscar licitaciones similares." });
            continue;
          }
          try {
            const rpc = await import("@/lib/server-rpc");
            const result = await rpc.licitacionesFindSimilarRpc({ data: { medicationIds: args.medicationIds } });
            const sims = result as { licitacion: { codigo: string; titulo: string; estado: string }; matchCount: number }[];
            if (sims.length > 0) {
              const lines = sims.map((s) => `- ${s.licitacion.codigo}: ${s.licitacion.titulo} (${s.licitacion.estado}, ${s.matchCount} medicamento(s) en común)`);
              const msg = `🔍 Se encontraron licitaciones activas que incluyen esos medicamentos:\n${lines.join("\n")}\n\nRevisalas antes de crear una nueva.`;
              setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
              return;
            } else {
              toolResults.push({ role: "assistant", content: "✅ No se encontraron licitaciones activas similares. Podés proceder a crear una nueva." });
            }
          } catch {
            toolResults.push({ role: "assistant", content: "Error al buscar licitaciones similares." });
          }
        } else if (tc.function.name === "create_transfer") {
          const args = parseCreateTransferArgs(JSON.parse(tc.function.arguments));
          if (!args) {
            toolResults.push({ role: "assistant", content: "❌ Parámetros inválidos para crear transferencia." });
            continue;
          }
          try {
            const rpc = await import("@/lib/server-rpc");
            await rpc.backofficeCreateTransferRpc({
              data: {
                medicationId: args.medicationId,
                sourceBatchId: args.sourceBatchId,
                fromWarehouseId: args.fromWarehouseId,
                toWarehouseId: args.toWarehouseId,
                quantity: args.quantity,
              },
            });
            toolResults.push({ role: "assistant", content: `✅ Transferencia creada: ${args.quantity} u. al destino seleccionado.` });
          } catch {
            toolResults.push({ role: "assistant", content: "❌ Error al crear la transferencia." });
          }
        } else if (tc.function.name === "navigate") {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          toolResults.push({ role: "assistant", content: `🔗 Navegación a "${args.path ?? "desconocido"}" — podés ir manualmente desde el menú lateral.` });
        }
      }

      if (toolResults.length > 0) {
        for (const r of toolResults) {
          setMessages((prev) => [...prev, r]);
        }
        await processLlmCall([...updatedHistory, ...toolResults], systemPrompt, depth + 1);
      }
    } else if (res.content) {
      setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: "No pude procesar la solicitud." }]);
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
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1 [&_tr]:border [&_hr]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_pre]:bg-black/5 [&_pre]:dark:bg-white/5 [&_pre]:rounded [&_pre]:p-2 [&_code]:text-xs]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Pensando...</div>
          </div>
        )}
        <div ref={chatEndRef} />
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

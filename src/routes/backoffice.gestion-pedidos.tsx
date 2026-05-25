import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, RefreshCw, Filter, Search, Package, CheckCircle2,
  Truck, ArrowRight, ArrowLeftRight, Hash, Calendar, User,
  Stethoscope, Pill, Building2, Warehouse, AlertTriangle,
  ThumbsUp, XCircle, DollarSign, Clock, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DemoAssistantChat } from "@/components/demo-assistant-chat";
import type { CrossHospitalMedStock, ProcurementResult, ProcurementItem } from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/gestion-pedidos")({
  component: GestionPedidosPage,
});

const ACTIVE_ORDER_STATUSES = [
  "pendiente", "aprobado", "despachado", "recibir", "recibido",
  "devolucion_solicitada",
];

const ORDER_TERMINAL_STATUSES = [
  "administrado", "rechazado", "devuelto", "devolucion_rechazada",
];

const orderStatusColor: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400",
  aprobado: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400",
  despachado: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-400",
  recibir: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-400",
  recibido: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400",
  rechazado: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400",
  devolucion_solicitada: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400",
  devuelto: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400",
  devolucion_rechazada: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-400",
};

const orderStatusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  despachado: "Despachado",
  recibir: "Por Recibir",
  recibido: "Recibido",
  rechazado: "Rechazado",
  devolucion_solicitada: "Dev. Solicitada",
  devuelto: "Devuelto",
  devolucion_rechazada: "Dev. Rechazada",
};

type OrderAction = "aprobar" | "despachar" | "marcar_recibir" | "confirmar_recepcion" | "rechazar";

const orderActionDef: Record<string, { action: OrderAction; label: string; icon: typeof ThumbsUp; nextStatus: string }> = {
  pendiente: { action: "aprobar", label: "Aprobar", icon: ThumbsUp, nextStatus: "aprobado" },
  aprobado: { action: "despachar", label: "Despachar", icon: Truck, nextStatus: "despachado" },
  despachado: { action: "marcar_recibir", label: "Recibir", icon: Package, nextStatus: "recibir" },
  recibir: { action: "confirmar_recepcion", label: "Confirmar", icon: CheckCircle2, nextStatus: "recibido" },
};

type WorkspaceStat = { id: string; name: string; totalUnits: number; totalUsers: number; totalWarehouses: number; movementsToday: number };
type RawOrder = Record<string, unknown>;
type RawTransfer = Record<string, unknown>;
type RawWarehouse = { id: string; name: string; type: string; unit: string; workspace_id: string };
type MedRef = { id: string; name: string; form: string; concentrationValue: number; concentrationUnit: string };

interface PageData {
  orders: RawOrder[];
  transfers: RawTransfer[];
  warehouses: RawWarehouse[];
  meds: MedRef[];
  workspaces: WorkspaceStat[];
  crossStock: CrossHospitalMedStock[];
  procurement: ProcurementResult[];
}

async function loadAllData(): Promise<PageData> {
  const [
    { backofficeGetRealtimeDataRpc },
    { backofficeGetAllMedicationsRpc },
    { backofficeGetDashboardDataRpc },
    { backofficeGetCrossHospitalStockRpc },
    { backofficeGetProcurementOptimizationRpc },
  ] = await Promise.all([
    import("@/lib/server-rpc"),
    import("@/lib/server-rpc"),
    import("@/lib/server-rpc"),
    import("@/lib/server-rpc"),
    import("@/lib/server-rpc"),
  ]);

  const [realtime, meds, dashboard, crossStock, procurement] = await Promise.all([
    backofficeGetRealtimeDataRpc({ data: {} }),
    backofficeGetAllMedicationsRpc(),
    backofficeGetDashboardDataRpc(),
    backofficeGetCrossHospitalStockRpc(),
    backofficeGetProcurementOptimizationRpc({ data: {} }),
  ]);

  return {
    orders: (realtime as { orders: RawOrder[] }).orders ?? [],
    transfers: (realtime as { transfers: RawTransfer[] }).transfers ?? [],
    warehouses: (realtime as { warehouses: RawWarehouse[] }).warehouses ?? [],
    meds: meds as MedRef[],
    workspaces: ((dashboard as { workspaces: WorkspaceStat[] })?.workspaces ?? []) as WorkspaceStat[],
    crossStock: crossStock as CrossHospitalMedStock[],
    procurement: procurement as ProcurementResult[],
  };
}

function GestionPedidosPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWs, setSelectedWs] = useState<string>("__all__");

  const [tab, setTab] = useState("activos");
  const [actionDialog, setActionDialog] = useState<{
    order: RawOrder;
    workspaceId: string;
    action: OrderAction;
    label: string;
  } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    order: RawOrder;
    workspaceId: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const [recSearch, setRecSearch] = useState("");
  const [recSelected, setRecSelected] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadAllData();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Lookup maps (always called) ──
  const medMap = useMemo(() => {
    const m = new Map<string, MedRef>();
    if (data) for (const med of data.meds) m.set(med.id, med);
    return m;
  }, [data]);

  const whMap = useMemo(() => {
    const m = new Map<string, RawWarehouse>();
    if (data) for (const wh of data.warehouses) m.set(wh.id, wh);
    return m;
  }, [data]);

  const wsMap = useMemo(() => {
    const m = new Map<string, WorkspaceStat>();
    if (data) for (const ws of data.workspaces) m.set(ws.id, ws);
    return m;
  }, [data]);

  const selectedWsName = selectedWs === "__all__" ? null : wsMap.get(selectedWs)?.name ?? null;

  const workspaces: WorkspaceStat[] = data?.workspaces ?? [];

  // ── Filter orders by workspace ──
  const filteredOrders = useMemo(() => {
    if (!data) return [];
    let list = data.orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as string));
    if (selectedWs !== "__all__") {
      list = list.filter((o) => {
        const wh = whMap.get(o.warehouse_id as string);
        return wh?.workspace_id === selectedWs;
      });
    }
    return list.sort((a, b) => new Date(b.requested_at as string).getTime() - new Date(a.requested_at as string).getTime());
  }, [data, selectedWs, whMap]);

  // ── Filter transfers by workspace ──
  const filteredTransfers = useMemo(() => {
    if (!data) return [];
    let list = data.transfers.filter((t) => (t.status as string) === "aceptado");
    if (selectedWs !== "__all__") {
      list = list.filter((t) => {
        const fwh = whMap.get(t.from_warehouse_id as string);
        const twh = whMap.get(t.to_warehouse_id as string);
        return fwh?.workspace_id === selectedWs || twh?.workspace_id === selectedWs;
      });
    }
    return list.sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
  }, [data, selectedWs, whMap]);

  // ── Procurement with deficit ──
  const deficitMeds = useMemo(() => {
    if (!data) return [];
    return data.procurement.filter((r) => r.items.some((i) => i.deficit > 0));
  }, [data]);

  const selectedProcResult = useMemo(() => {
    if (!recSelected || !data) return null;
    return data.procurement.find((r) => r.medicationName === recSelected) ?? null;
  }, [recSelected, data]);

  const procFilteredList = useMemo(() => {
    if (!recSearch) return deficitMeds;
    const q = recSearch.toLowerCase();
    return deficitMeds.filter((r) => r.medicationName.toLowerCase().includes(q));
  }, [deficitMeds, recSearch]);

  // ── Helpers ──
  const orderMedName = useCallback((o: RawOrder) => {
    const med = medMap.get(o.medication_id as string);
    return med ? `${med.name} ${med.concentrationValue}${med.concentrationUnit}` : (o.medication_id as string);
  }, [medMap]);

  const orderWhName = useCallback((o: RawOrder) => {
    const wh = whMap.get(o.warehouse_id as string);
    const wsName = wh ? wsMap.get(wh.workspace_id)?.name ?? wh.workspace_id : "";
    const whName = wh?.name ?? (o.warehouse_id as string);
    return `${wsName} · ${whName}`;
  }, [whMap, wsMap]);

  const transferMedName = useCallback((t: RawTransfer) => {
    const med = medMap.get(t.medication_id as string);
    return med ? `${med.name} ${med.concentrationValue}${med.concentrationUnit}` : (t.medication_id as string);
  }, [medMap]);

  const transferWhName = useCallback((whId: string) => {
    const wh = whMap.get(whId);
    return wh?.name ?? whId;
  }, [whMap]);

  const executeAction = useCallback(async (order: RawOrder, wsId: string, action: OrderAction, reason?: string) => {
    setActing(true);
    try {
      const { runActionRpc } = await import("@/lib/server-rpc");
      const payload: Record<string, unknown> = {
        workspaceId: wsId,
        actor: "Backoffice",
        actorRole: "admin",
        id: order.id,
        action,
      };
      if (reason) payload.reason = reason;

      await runActionRpc({ data: { action: "processOrder", payload } });
      toast.success(`Pedido ${orderActionDef[order.status as string]?.label.toLowerCase() ?? action} con éxito`);
      setActionDialog(null);
      setRejectDialog(null);
      setRejectReason("");
      await fetchData();
    } catch (e) {
      toast.error("Error al procesar pedido", { description: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setActing(false);
    }
  }, [fetchData]);

  // ── Early returns ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <ClipboardList size={40} className="text-primary" />
        </motion.div>
        <p className="text-muted-foreground">Cargando datos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-red-600">
        <p className="font-medium">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw size={16} className="mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const activeCounts = {
    pendiente: filteredOrders.filter((o) => o.status === "pendiente").length,
    aprobado: filteredOrders.filter((o) => o.status === "aprobado").length,
    despachado: filteredOrders.filter((o) => o.status === "despachado").length,
    recibir: filteredOrders.filter((o) => o.status === "recibir").length,
  };

  const transferTotalUnits = filteredTransfers.reduce((s, t) => s + (t.quantity as number), 0);

  return (
    <div id="gestion-pedidos" className="pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Main content */}
        <div className="space-y-6 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList className="text-primary" size={26} />
                Pedidos medicos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedWs === "__all__" ? "Datos de todos los hospitales" : selectedWsName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedWs} onValueChange={(v) => { setSelectedWs(v); setRecSelected(null); }}>
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
              <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                <RefreshCw size={14} /> Actualizar
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => { setTab(v); fetchData(); }}>
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              <TabsTrigger value="activos" className="gap-1.5">
                <Clock size={14} /> En curso
                {filteredOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                    {filteredOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="recomendados" className="gap-1.5">
                <AlertTriangle size={14} /> Recomendados
                {deficitMeds.length > 0 && (
                  <span className="ml-1 rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-semibold">
                    {deficitMeds.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="transferencias" className="gap-1.5">
                <ArrowLeftRight size={14} /> Transferencias
              </TabsTrigger>
            </TabsList>

            {/* ════════════════ Tab: Activos ════════════════ */}
            <TabsContent value="activos" className="space-y-4 mt-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Pendientes", count: activeCounts.pendiente, color: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30" },
                  { label: "Aprobados", count: activeCounts.aprobado, color: "border-blue-300 bg-blue-50 dark:bg-blue-950/30" },
                  { label: "Despachados", count: activeCounts.despachado, color: "border-purple-300 bg-purple-50 dark:bg-purple-950/30" },
                  { label: "Por Recibir", count: activeCounts.recibir, color: "border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30" },
                ].map((s) => (
                  <Card key={s.label} className={`${s.color} border-2`}>
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{s.count}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Table */}
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <CheckCircle2 size={40} className="opacity-40" />
                    <p className="font-medium">No hay pedidos en curso</p>
                    <p className="text-sm">Todos los pedidos han sido procesados</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicamento</TableHead>
                          <TableHead className="hidden md:table-cell">Hospital · Depósito</TableHead>
                          <TableHead className="text-center">Cant.</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="hidden lg:table-cell">Doctor</TableHead>
                          <TableHead className="hidden lg:table-cell">Paciente</TableHead>
                          <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((o) => {
                          const def = orderActionDef[o.status as string];
                          const ActIcon = def?.icon;
                          return (
                            <TableRow key={o.id as string}>
                              <TableCell className="font-medium">{orderMedName(o)}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{orderWhName(o)}</TableCell>
                              <TableCell className="text-center">{o.quantity as number}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${orderStatusColor[o.status as string] ?? ""}`}>
                                  {orderStatusLabel[o.status as string] ?? (o.status as string)}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{o.doctor as string}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{o.patient as string}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                {new Date(o.requested_at as string).toLocaleDateString("es-AR")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {def && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        const wh = whMap.get(o.warehouse_id as string);
                                        setActionDialog({
                                          order: o,
                                          workspaceId: wh?.workspace_id ?? "",
                                          action: def.action,
                                          label: def.label,
                                        });
                                      }}
                                    >
                                      <ActIcon size={12} /> {def.label}
                                    </Button>
                                  )}
                                  {o.status === "pendiente" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                                      onClick={() => {
                                        const wh = whMap.get(o.warehouse_id as string);
                                        setRejectDialog({ order: o, workspaceId: wh?.workspace_id ?? "" });
                                      }}
                                    >
                                      <Ban size={12} />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ════════════════ Tab: Recomendados ════════════════ */}
            <TabsContent value="recomendados" className="mt-4">
              {deficitMeds.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <CheckCircle2 size={40} className="opacity-40" />
                    <p className="font-medium">No hay medicamentos con déficit</p>
                    <p className="text-sm">Todos los stocks están dentro de los niveles óptimos</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                  {/* Selector */}
                  <Card className="h-fit">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Medicamentos</CardTitle>
                      <CardDescription className="text-xs">{deficitMeds.length} con déficit</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar…"
                          value={recSearch}
                          onChange={(e) => setRecSearch(e.target.value)}
                          className="pl-7 h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                        {procFilteredList.map((r) => {
                          const totalDeficit = r.items.reduce((s, i) => s + i.deficit, 0);
                          const isSelected = recSelected === r.medicationName;
                          return (
                            <button
                              key={r.medicationName}
                              onClick={() => setRecSelected(r.medicationName)}
                              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-between gap-2 ${
                                isSelected
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <span className="truncate">{r.medicationName}</span>
                              <Badge variant="outline" className="shrink-0 text-[10px] bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400">
                                -{totalDeficit}
                              </Badge>
                            </button>
                          );
                        })}
                        {procFilteredList.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detail */}
                  <AnimatePresence mode="wait">
                    {!recSelected || !selectedProcResult ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Card>
                          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                            <Search size={40} className="opacity-40" />
                            <p className="font-medium">Seleccioná un medicamento</p>
                            <p className="text-sm">Elegí de la lista para ver recomendaciones de compra</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={selectedProcResult.medicationName}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {/* Header */}
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{selectedProcResult.medicationName}</CardTitle>
                                <CardDescription>
                                  Precio unitario: ${selectedProcResult.salePrice.toLocaleString("es-AR")}
                                </CardDescription>
                              </div>
                              {selectedProcResult.totalSaving > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 gap-1">
                                  <DollarSign size={12} /> Ahorro ${selectedProcResult.totalSaving.toLocaleString("es-AR")}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                        </Card>

                        {/* Cost comparison */}
                        <div className="grid grid-cols-2 gap-3">
                          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
                            <CardContent className="py-3">
                              <p className="text-xs text-muted-foreground">Sin transferencias</p>
                              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                                ${selectedProcResult.totalCostWithoutTransfers.toLocaleString("es-AR")}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                            <CardContent className="py-3">
                              <p className="text-xs text-muted-foreground">Con transferencias</p>
                              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                ${selectedProcResult.totalCostWithTransfers.toLocaleString("es-AR")}
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Per-hospital table */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Desglose por hospital</CardTitle>
                          </CardHeader>
                          <CardContent className="px-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Hospital</TableHead>
                                  <TableHead className="text-right">Stock</TableHead>
                                  <TableHead className="text-right">Mín</TableHead>
                                  <TableHead className="text-right">Óptimo</TableHead>
                                  <TableHead className="text-right">Déficit</TableHead>
                                  <TableHead className="text-right">Excedente</TableHead>
                                  <TableHead className="text-right">Pedido</TableHead>
                                  <TableHead className="text-right">Costo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedProcResult.items.map((item: ProcurementItem) => {
                                  const wsFiltered = selectedWs === "__all__" || item.workspaceId === selectedWs;
                                  if (!wsFiltered) return null;
                                  return (
                                    <TableRow key={item.workspaceId}>
                                      <TableCell className="font-medium text-xs">{item.workspaceName}</TableCell>
                                      <TableCell className="text-right text-xs">{item.currentStock}</TableCell>
                                      <TableCell className="text-right text-xs">{item.minStock}</TableCell>
                                      <TableCell className="text-right text-xs">{item.optimalStock}</TableCell>
                                      <TableCell className="text-right">
                                        {item.deficit > 0 ? (
                                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400">
                                            -{item.deficit}
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {item.surplus > 0 ? (
                                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400">
                                            +{item.surplus}
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-xs font-medium">{item.orderWithoutTransfers}</TableCell>
                                      <TableCell className="text-right text-xs">${item.costWithoutTransfers.toLocaleString("es-AR")}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* ════════════════ Tab: Transferencias ════════════════ */}
            <TabsContent value="transferencias" className="space-y-4 mt-4">
              {/* Summary */}
              <Card className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200">
                <CardContent className="py-3 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm">
                      <strong className="text-lg">{filteredTransfers.length}</strong> transferencias completadas
                    </span>
                  </div>
                  <div className="h-6 w-px bg-emerald-200 hidden sm:block" />
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span><strong className="text-lg">{transferTotalUnits.toLocaleString("es-AR")}</strong> unidades transferidas</span>
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              {filteredTransfers.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <ArrowLeftRight size={40} className="opacity-40" />
                    <p className="font-medium">No hay transferencias realizadas</p>
                    <p className="text-sm">Las transferencias completadas aparecerán aquí</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicamento</TableHead>
                          <TableHead className="hidden sm:table-cell">Origen</TableHead>
                          <TableHead className="hidden sm:table-cell">Destino</TableHead>
                          <TableHead className="text-center">Cant.</TableHead>
                          <TableHead className="hidden md:table-cell">Código</TableHead>
                          <TableHead className="hidden lg:table-cell">Solicitó</TableHead>
                          <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransfers.map((t) => (
                          <TableRow key={t.id as string}>
                            <TableCell className="font-medium">{transferMedName(t)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{transferWhName(t.from_warehouse_id as string)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <ArrowRight size={10} /> {transferWhName(t.to_warehouse_id as string)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{t.quantity as number}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">{t.transfer_code as string ?? "—"}</TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">{t.requested_by as string}</TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              {new Date(t.date as string).toLocaleDateString("es-AR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidepanel */}
        <div className="lg:sticky lg:top-4 self-start h-[calc(100vh-8rem)]">
          <DemoAssistantChat
            variant="sidepanel"
            lossData={null as unknown as import("@/lib/server/backoffice-service").LossCalculationResult}
            crossStock={data.crossStock}
            volumeData={null as unknown as import("@/lib/server/backoffice-service").WarehouseVolumeItem[]}
            totalUnits={0}
          />
        </div>
      </div>

      {/* ── Action confirmation dialog ── */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar acción</DialogTitle>
            <DialogDescription>
              {actionDialog && (
                <>¿{actionDialog.label} pedido de <strong>{orderMedName(actionDialog.order)}</strong>?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={acting}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!actionDialog) return;
                executeAction(actionDialog.order, actionDialog.workspaceId, actionDialog.action);
              }}
              disabled={acting}
            >
              {acting ? "Procesando…" : actionDialog?.label ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ── */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar pedido</DialogTitle>
            <DialogDescription>
              {rejectDialog && (
                <>Rechazar pedido de <strong>{orderMedName(rejectDialog.order)}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo del rechazo</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ingresá el motivo…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }} disabled={acting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectDialog) return;
                executeAction(rejectDialog.order, rejectDialog.workspaceId, "rechazar", rejectReason || undefined);
              }}
              disabled={acting || !rejectReason.trim()}
            >
              {acting ? "Rechazando…" : "Rechazar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

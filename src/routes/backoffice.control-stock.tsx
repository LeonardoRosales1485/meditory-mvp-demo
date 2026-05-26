import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package, Search, AlertCircle, ArrowLeftRight, Filter, TrendingDown, TrendingUp,
  RefreshCw, CalendarDays, Building2,
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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { daysUntil, expiryStatus } from "@/lib/domain-types";
import type { CrossHospitalMedStock, LowStockMedication, OverstockMedication } from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/control-stock")({
  component: ControlStockPage,
});

const EXPIRY_STATUS_COLORS: Record<string, string> = {
  vencido: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  critico: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  proximo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  ok: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const EXPIRY_STATUS_LABELS: Record<string, string> = {
  vencido: "Vencido",
  critico: "Crítico (<30d)",
  proximo: "Próximo (<90d)",
  ok: "OK",
};

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

function ControlStockPage() {
  const [tab, setTab] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWs, setSelectedWs] = useState<string>("__all__");
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);

  // Tab 1 — Stock
  const [crossStock, setCrossStock] = useState<CrossHospitalMedStock[]>([]);
  const [allMeds, setAllMeds] = useState<{ id: string; name: string; form: string }[]>([]);
  const [searchMed, setSearchMed] = useState("");

  // Tab 2 — Vencimientos
  const [batches, setBatches] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; workspace_id: string }[]>([]);
  const [searchBatch, setSearchBatch] = useState("");

  // Tab 3 — Alertas
  const [lowStock, setLowStock] = useState<LowStockMedication[]>([]);
  const [overstock, setOverstock] = useState<OverstockMedication[]>([]);

  // Tab 4 — Transferencias
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [tFormMed, setTFormMed] = useState("");
  const [tFormFrom, setTFormFrom] = useState("");
  const [tFormTo, setTFormTo] = useState("");
  const [tFormQty, setTFormQty] = useState(1);
  const [searchTransfer, setSearchTransfer] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const rpc = await import("@/lib/server-rpc");

      const [cs, meds, rt, ls, os, wss] = await Promise.all([
        rpc.backofficeGetCrossHospitalStockRpc().catch(() => []),
        rpc.backofficeGetAllMedicationsRpc().catch(() => []),
        rpc.backofficeGetRealtimeDataRpc({ data: {} }).catch(() => ({
          batches: [], movements: [], orders: [], transfers: [],
          warehouses: [], medications: [], stockConfig: [],
        })),
        rpc.licitacionesGetLowStockRpc().catch(() => []),
        rpc.licitacionesGetOverstockRpc().catch(() => []),
        rpc.licitacionesGetWorkspacesRpc().catch(() => []),
      ]);

      setCrossStock(cs as CrossHospitalMedStock[]);
      setAllMeds(meds as { id: string; name: string; form: string }[]);
      setLowStock(ls as LowStockMedication[]);
      setOverstock(os as OverstockMedication[]);
      setWorkspaces(wss as { id: string; name: string }[]);

      const rtData = rt as {
        batches: any[]; transfers: any[];
        warehouses: { id: string; name: string; workspace_id: string }[];
        medications: any[];
      };
      setBatches(rtData.batches);
      setTransfers(rtData.transfers);
      setWarehouses(rtData.warehouses);
      setMedications(rtData.medications);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // ── Derived ──
  const selectedWsName = selectedWs === "__all__" ? null : workspaces.find((ws) => ws.id === selectedWs)?.name ?? null;

  const medMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const med of medications) m.set(med.id, med.name);
    for (const med of allMeds) if (!m.has(med.id)) m.set(med.id, med.name);
    return m;
  }, [medications, allMeds]);

  const whMap = useMemo(() => {
    const m = new Map(warehouses.map((w) => [w.id, w.name]));
    return m;
  }, [warehouses]);

  const workspaceByWarehouse = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) {
      m.set(w.id, w.workspace_id);
    }
    return m;
  }, [warehouses]);

  const whFullMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) {
      const wsName = workspaces.find((ws) => ws.id === w.workspace_id)?.name ?? "";
      m.set(w.id, wsName ? `${wsName} - ${w.name}` : w.name);
    }
    return m;
  }, [warehouses, workspaces]);

  // ── Tab 1: Filtered cross stock ──
  const filteredCrossStock = useMemo(() => {
    let list = crossStock;
    if (selectedWs !== "__all__" && selectedWsName) {
      list = list
        .map((m) => ({
          ...m,
          stocks: m.stocks.filter((s) => s.workspaceName === selectedWsName),
        }))
        .filter((m) => m.stocks.length > 0);
    }
    if (searchMed) {
      const q = searchMed.toLowerCase();
      list = list.filter((m) => m.medicationName.toLowerCase().includes(q));
    }
    return list;
  }, [crossStock, selectedWs, selectedWsName, searchMed]);

  // ── Tab 2: Filtered batches ──
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (selectedWs !== "__all__" && selectedWsName) {
      const wsWhIds = new Set(
        warehouses.filter((w) => w.workspace_id === selectedWs).map((w) => w.id)
      );
      list = list.filter((b) => wsWhIds.has(b.warehouse_id));
    }
    if (searchBatch) {
      const q = searchBatch.toLowerCase();
      list = list.filter((b) => {
        const medName = medMap.get(b.medication_id) ?? "";
        const whName = whMap.get(b.warehouse_id) ?? "";
        return medName.toLowerCase().includes(q) || whName.toLowerCase().includes(q) ||
          (b.lot ?? "").toLowerCase().includes(q);
      });
    }
    return list.filter((b) => {
      if (!b.expiry) return false;
      const days = daysUntil(b.expiry);
      return days < 90;
    }).sort((a, b) => {
      return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
    });
  }, [batches, selectedWs, selectedWsName, warehouses, searchBatch, medMap, whMap]);

  // ── Tab 3: Alert suggestions (system-generated) ──
  const suggestions = useMemo(() => {
    type Suggestion = {
      medicationName: string;
      medicationId: string;
      deficitWorkspace: string;
      deficitWarehouse: string;
      deficit: number;
      surplusWorkspace: string;
      surplusWarehouse: string;
      surplus: number;
      suggestedQty: number;
    };

    const filteredLs = selectedWs === "__all__" ? lowStock
      : lowStock.filter((l) => l.workspaceId === selectedWs);
    const filteredOs = selectedWs === "__all__" ? overstock
      : overstock.filter((o) => o.workspaceId !== selectedWs || selectedWs === "__all__");

    const suggestions: Suggestion[] = [];

    for (const deficit of filteredLs) {
      const matchingSurpluses = filteredOs.filter(
        (o) => o.medicationId === deficit.medicationId && o.workspaceId !== deficit.workspaceId
      );
      for (const surplus of matchingSurpluses) {
        const suggestedQty = Math.min(deficit.deficit, surplus.surplus);
        if (suggestedQty <= 0) continue;

        const defWh = warehouses.find(
          (w) => w.workspace_id === deficit.workspaceId
        );
        const surWh = warehouses.find(
          (w) => w.workspace_id === surplus.workspaceId
        );

        suggestions.push({
          medicationName: deficit.medicationName,
          medicationId: deficit.medicationId,
          deficitWorkspace: deficit.workspaceName,
          deficitWarehouse: defWh?.id ?? "",
          deficit: deficit.deficit,
          surplusWorkspace: surplus.workspaceName,
          surplusWarehouse: surWh?.id ?? "",
          surplus: surplus.surplus,
          suggestedQty,
        });
      }
    }

    return suggestions;
  }, [lowStock, overstock, selectedWs, warehouses]);

  // ── Tab 4: Filtered transfers ──
  const filteredTransfers = useMemo(() => {
    let list = transfers;
    if (selectedWs !== "__all__" && selectedWsName) {
      const wsWhIds = new Set(
        warehouses.filter((w) => w.workspace_id === selectedWs).map((w) => w.id)
      );
      list = list.filter((t) => wsWhIds.has(t.from_warehouse_id) || wsWhIds.has(t.to_warehouse_id));
    }
    if (searchTransfer) {
      const q = searchTransfer.toLowerCase();
      list = list.filter((t) => {
        const medName = medMap.get(t.medication_id) ?? "";
        const fromName = whFullMap.get(t.from_warehouse_id) ?? "";
        const toName = whFullMap.get(t.to_warehouse_id) ?? "";
        return medName.toLowerCase().includes(q) || fromName.toLowerCase().includes(q) ||
          toName.toLowerCase().includes(q) || (t.transfer_code ?? "").toLowerCase().includes(q);
      });
    }
    return list.sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
    );
  }, [transfers, selectedWs, selectedWsName, warehouses, searchTransfer, medMap, whFullMap]);

  const wsWarehouses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const w of warehouses) {
      const list = map.get(w.workspace_id) ?? [];
      list.push({ id: w.id, name: w.name });
      map.set(w.workspace_id, list);
    }
    return map;
  }, [warehouses]);

  async function handleCreateTransfer() {
    if (!tFormMed || !tFormFrom || !tFormTo || tFormQty <= 0) {
      toast.error("Completá todos los campos");
      return;
    }
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeCreateOverstockTransferRpc({
        data: {
          medicationId: tFormMed,
          fromWarehouseId: tFormFrom,
          toWarehouseId: tFormTo,
          quantity: tFormQty,
          requestedBy: "Admin",
        },
      });
      toast.success("Transferencia creada");
      setTransferOpen(false);
      setTFormMed("");
      setTFormFrom("");
      setTFormTo("");
      setTFormQty(1);
      loadAll();
    } catch {
      toast.error("Error al crear transferencia");
    }
  }

  async function handleAdvanceTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeAdvanceTransferRpc({ data: { id } });
      setTransfers((prev) => prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status:
                t.status === "solicitado" ? "autorizado"
                : t.status === "autorizado" ? "despachado"
                : t.status === "despachado" ? "recibir"
                : t.status === "recibir" ? "recibido"
                : "aceptado",
            }
          : t
      ));
    } catch {
      toast.error("Error al avanzar transferencia");
    }
  }

  async function handleCancelTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeCancelTransferRpc({ data: { id } });
      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: "rechazado" } : t
      ));
      toast.success("Transferencia cancelada");
    } catch {
      toast.error("Error al cancelar transferencia");
    }
  }

  async function handleRejectTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeRejectTransferRpc({
        data: { id, reason: "Rechazado por administrador", outcome: "devolver" },
      });
      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: "rechazado" } : t
      ));
      toast.success("Transferencia rechazada");
    } catch {
      toast.error("Error al rechazar transferencia");
    }
  }

  // ── Render ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Package size={40} className="text-primary" />
        </motion.div>
        <p className="text-muted-foreground">Cargando control de stock…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-red-600">
        <p className="font-medium">{error}</p>
        <Button variant="outline" onClick={loadAll}>
          <RefreshCw size={16} className="mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  const deficitCount = lowStock.length;
  const expiringCount = batches.filter((b) => {
    if (!b.expiry) return false;
    const days = daysUntil(b.expiry);
    return days >= 0 && days < 90;
  }).length;
  const expiredCount = batches.filter((b) => {
    if (!b.expiry) return false;
    return daysUntil(b.expiry) < 0;
  }).length;
  const activeTransfers = transfers.filter(
    (t) => !["recibido", "rechazado", "aceptado"].includes(t.status)
  ).length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Package className="text-primary" size={26} />
        <div>
          <h1 className="text-2xl font-bold">Control de stock</h1>
          <p className="text-sm text-muted-foreground">
            {selectedWs === "__all__" ? "Visión consolidada de todos los hospitales" : selectedWsName}
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
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
            <RefreshCw size={14} /> Actualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package size={16} />
              <span className="text-xs font-medium">Stock General</span>
            </div>
            <p className="text-2xl font-black">{crossStock.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">medicamentos monitoreados</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Alertas</span>
            </div>
            <p className="text-2xl font-black">{deficitCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">medicamentos con déficit</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <CalendarDays size={16} />
              <span className="text-xs font-medium">Vencimientos</span>
            </div>
            <p className="text-2xl font-black">{expiredCount + expiringCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{expiredCount} vencidos + {expiringCount} próximos</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <ArrowLeftRight size={16} />
              <span className="text-xs font-medium">Transferencias</span>
            </div>
            <p className="text-2xl font-black">{activeTransfers} <span className="text-base font-normal text-muted-foreground">/ {transfers.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">activas / total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="stock" className="gap-1.5 text-xs"><Package size={14} />Stock</TabsTrigger>
          <TabsTrigger value="vencimientos" className="gap-1.5 text-xs"><CalendarDays size={14} />Vencimientos</TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5 text-xs"><AlertCircle size={14} />Alertas</TabsTrigger>
          <TabsTrigger value="transferencias" className="gap-1.5 text-xs"><ArrowLeftRight size={14} />Transferencias</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Stock ─── */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por medicamento..."
                value={searchMed}
                onChange={(e) => setSearchMed(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {filteredCrossStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchMed ? "Sin resultados" : "No hay datos de stock"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Precio</TableHead>
                      <TableHead className="text-xs text-right">
                        {workspaces.length > 0
                          ? workspaces.map((ws) => ws.name.split(" ").slice(1).join(" ") || ws.name).join(" / ")
                          : "Stock"}
                      </TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Déficit</TableHead>
                      <TableHead className="text-xs text-right">Superávit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCrossStock.slice(0, 100).map((item, idx) => {
                      const totalStock = item.stocks.reduce((s, ws) => s + ws.quantity, 0);
                      const totalMin = item.stocks.reduce((s, ws) => s + ws.minStock, 0);
                      const totalOpt = item.stocks.reduce((s, ws) => s + ws.optimalStock, 0);
                      const deficit = Math.max(0, totalMin - totalStock);
                      const surplus = Math.max(0, totalStock - totalOpt);
                      return (
                        <TableRow key={item.medicationName + "::" + idx}>
                          <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            ${item.salePrice.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <div className="flex justify-end gap-3">
                              {workspaces.map((ws) => {
                                const wsStock = item.stocks.find((s) => s.workspaceName === ws.name);
                                return (
                                  <span key={ws.id} className="tabular-nums w-16 text-right">
                                    {wsStock ? wsStock.quantity.toLocaleString("es-AR") : "—"}
                                  </span>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {totalStock.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {deficit > 0 ? (
                              <Badge variant="destructive" className="text-[10px]">
                                -{deficit.toLocaleString("es-AR")}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {surplus > 0 ? (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] border-0">
                                +{surplus.toLocaleString("es-AR")}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Vencimientos ─── */}
        <TabsContent value="vencimientos" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por medicamento, lote o depósito..."
                value={searchBatch}
                onChange={(e) => setSearchBatch(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Mostrando lotes con vencimiento &lt; 90 días
            </span>
          </div>
          <Card>
            <CardContent className="p-0">
              {filteredBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchBatch ? "Sin resultados" : "No hay lotes próximos a vencer"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Lote</TableHead>
                      <TableHead className="text-xs">Depósito</TableHead>
                      <TableHead className="text-xs text-right">Cantidad</TableHead>
                      <TableHead className="text-xs">Vencimiento</TableHead>
                      <TableHead className="text-xs">Faltan</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((b, idx) => {
                      const days = daysUntil(b.expiry);
                      const status = expiryStatus(b.expiry);
                      const whFull = whFullMap.get(b.warehouse_id) ?? whMap.get(b.warehouse_id) ?? b.warehouse_id?.slice(0, 8);
                      return (
                        <TableRow key={b.id ?? idx}>
                          <TableCell className="text-sm font-medium">
                            {medMap.get(b.medication_id) ?? b.medication_id?.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{b.lot ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{whFull}</TableCell>
                          <TableCell className="text-right text-sm">{b.quantity.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(b.expiry).toLocaleDateString("es-AR")}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={days < 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                              {days < 0 ? `venció hace ${Math.abs(days)}d` : `en ${days}d`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${EXPIRY_STATUS_COLORS[status] ?? ""}`}
                            >
                              {EXPIRY_STATUS_LABELS[status] ?? status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-200 dark:bg-red-800" />
              Vencido
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-orange-200 dark:bg-orange-800" />
              Crítico (&lt;30 días)
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-yellow-200 dark:bg-yellow-800" />
              Próximo (&lt;90 días)
            </div>
          </div>
        </TabsContent>

        {/* ─── Tab 3: Alertas ─── */}
        <TabsContent value="alertas" className="space-y-4">
          {lowStock.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No hay alertas de stock activas</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Resumen de déficits */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown size={14} className="text-red-500" />
                    Medicamentos con Déficit
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {lowStock.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Sin déficits</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Medicamento</TableHead>
                          <TableHead className="text-xs">Hospital</TableHead>
                          <TableHead className="text-xs text-right">Stock Actual</TableHead>
                          <TableHead className="text-xs text-right">Stock Mínimo</TableHead>
                          <TableHead className="text-xs text-right">Déficit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStock.slice(0, 50).map((item, idx) => (
                          <TableRow key={item.medicationId + "::" + item.workspaceId + "::" + idx}>
                            <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.workspaceName}</TableCell>
                            <TableCell className="text-right text-sm">{item.currentStock.toLocaleString("es-AR")}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{item.minStock.toLocaleString("es-AR")}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive" className="text-xs">
                                -{item.deficit.toLocaleString("es-AR")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Sugerencias generadas por el sistema */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowLeftRight size={14} className="text-purple-500" />
                    Sugerencias de Transferencias
                    <span className="text-xs font-normal text-muted-foreground">
                      (generadas automáticamente por el sistema)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {suggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No hay sugerencias disponibles — ningún superávit coincide con los déficits actuales
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Medicamento</TableHead>
                          <TableHead className="text-xs">Hospital con Déficit</TableHead>
                          <TableHead className="text-xs text-right">Cant. Faltante</TableHead>
                          <TableHead className="text-xs">Hospital con Superávit</TableHead>
                          <TableHead className="text-xs text-right">Cant. Excedente</TableHead>
                          <TableHead className="text-xs text-right">Sugerencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suggestions.slice(0, 50).map((s, idx) => (
                          <TableRow key={s.medicationId + "::" + s.deficitWorkspace + "::" + idx}>
                            <TableCell className="text-sm font-medium">{s.medicationName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.deficitWorkspace}</TableCell>
                            <TableCell className="text-right text-sm">
                              <span className="text-red-600 font-medium">{s.deficit.toLocaleString("es-AR")}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.surplusWorkspace}</TableCell>
                            <TableCell className="text-right text-sm">
                              <span className="text-blue-600 font-medium">+{s.surplus.toLocaleString("es-AR")}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                Transferir {s.suggestedQty.toLocaleString("es-AR")} desde {s.surplusWorkspace}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 4: Transferencias ─── */}
        <TabsContent value="transferencias" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar transferencia..."
                  value={searchTransfer}
                  onChange={(e) => setSearchTransfer(e.target.value)}
                  className="pl-8 text-sm h-8"
                />
              </div>
            </div>
            <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-1.5">
              <ArrowLeftRight size={14} /> Nueva Transferencia
            </Button>
          </div>

          {/* Formulario de nueva transferencia */}
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva Transferencia</DialogTitle>
                <DialogDescription className="sr-only">Crear una nueva transferencia de stock entre depósitos</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Medicamento</Label>
                  <select
                    value={tFormMed}
                    onChange={(e) => setTFormMed(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
                  >
                    <option value="">Seleccionar...</option>
                    {allMeds.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Origen (depósito)</Label>
                  <select
                    value={tFormFrom}
                    onChange={(e) => setTFormFrom(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
                  >
                    <option value="">Seleccionar...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {whFullMap.get(w.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Destino (depósito)</Label>
                  <select
                    value={tFormTo}
                    onChange={(e) => setTFormTo(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
                  >
                    <option value="">Seleccionar...</option>
                    {warehouses
                      .filter((w) => w.id !== tFormFrom)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {whFullMap.get(w.id)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    value={tFormQty}
                    onChange={(e) => setTFormQty(Number(e.target.value))}
                    min={1}
                    className="text-sm h-8 mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleCreateTransfer} disabled={!tFormMed || !tFormFrom || !tFormTo || tFormQty <= 0}>
                  Transferir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Lista de transferencias */}
          <Card>
            <CardContent className="p-0">
              {filteredTransfers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchTransfer ? "Sin resultados" : "No hay transferencias aún"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Origen</TableHead>
                      <TableHead className="text-xs">Destino</TableHead>
                      <TableHead className="text-xs text-right">Cant.</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransfers.map((t) => (
                      <TableRow key={t.id} className="text-xs">
                        <TableCell className="font-mono">{t.transfer_code ?? t.id.slice(0, 8)}</TableCell>
                        <TableCell>{medMap.get(t.medication_id) ?? t.medication_id?.slice(0, 8)}</TableCell>
                        <TableCell>{whFullMap.get(t.from_warehouse_id) ?? t.from_warehouse_id?.slice(0, 8)}</TableCell>
                        <TableCell>{whFullMap.get(t.to_warehouse_id) ?? t.to_warehouse_id?.slice(0, 8)}</TableCell>
                        <TableCell className="text-right">{t.quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${TRANSFER_STATUS_COLORS[t.status] ?? ""}`}
                          >
                            {TRANSFER_STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.date ? new Date(t.date).toLocaleDateString("es-AR") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!["aceptado", "rechazado"].includes(t.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleAdvanceTransfer(t.id)}
                                title="Avanzar al siguiente estado"
                              >
                                <ArrowLeftRight size={14} />
                              </Button>
                            )}
                            {t.status === "solicitado" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => handleCancelTransfer(t.id)}
                                title="Cancelar transferencia"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            )}
                            {t.status === "recibido" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => handleRejectTransfer(t.id)}
                                title="Rechazar transferencia"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

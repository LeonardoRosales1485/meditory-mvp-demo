import { useEffect, useRef, useState, useContext, useMemo, Fragment } from "react";
import { Activity, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Clock, Calendar, Package, AlertTriangle, CalendarClock, ClipboardList, CheckCircle2, XCircle, ArrowLeftRight, PackageCheck, CircleCheckBig, Filter, BarChart3, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { expiryStatus, formatDate } from "@/lib/domain-types";
import { useSimulation, SimValue, DeltaCtx } from "@/components/realtime-simulation";
import type { CrossHospitalMedStock } from "@/lib/server/backoffice-service";

type Batch = { id: string; medication_id: string; warehouse_id: string; lot: string; expiry: string; quantity: number };
type Movement = { id: string; type: string; medication_id: string; warehouse_id: string; quantity: number; user_name: string; reason: string; lot?: string; date: string };
type Order = { id: string; medication_id: string; warehouse_id: string; quantity: number; doctor: string; patient: string; room: string; reason: string; status: string; requested_at: string; processed_at?: string; processed_by?: string };
type Transfer = { id: string; transfer_code?: string; medication_id: string; from_warehouse_id: string; to_warehouse_id: string; quantity: number; status: string; requested_by: string; date: string };
type Warehouse = { id: string; name: string; type: string; unit: string; workspace_id: string };
type Medication = { id: string; name: string; concentration_value: number; concentration_unit: string };
type StockConfig = { medication_id: string; warehouse_id: string; min_stock: number; optimal_stock: number };

interface RealtimeData {
  batches: Batch[];
  movements: Movement[];
  orders: Order[];
  transfers: Transfer[];
  warehouses: Warehouse[];
  medications: Medication[];
  stockConfig: StockConfig[];
}

type TrendItem = {
  medication_id: string;
  medication_name: string;
  stock_total: number;
  consumed_per_day: number;
  days_until_empty: number | null;
  risk_category: string;
};

type SubTab = "stock" | "movements" | "orders" | "transfers" | "trends";

const SUB_TABS = [
  { value: "stock", label: "Stock" },
  { value: "movements", label: "Movimientos" },
  { value: "orders", label: "Pedidos" },
  { value: "transfers", label: "Transferencias" },
  { value: "trends", label: "Tendencias" },
] as const;

const CHART_COLORS = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)",
];

const EXPIRY_COLORS: Record<string, string> = {
  vencido: "var(--color-destructive)",
  critico: "var(--color-warning)",
  proximo: "var(--color-chart-2)",
  ok: "var(--color-chart-5)",
};

const EXPIRY_LABELS: Record<string, string> = {
  vencido: "Vencido", critico: "Crítico (≤30d)", proximo: "Próximo (≤90d)", ok: "Ok",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente", aprobado: "Aprobado", despachado: "Despachado",
  recibir: "A recibir", recibido: "Recibido", administrado: "Administrado",
  rechazado: "Rechazado", devolucion_solicitada: "Dev. solicitada",
  devuelto: "Devuelto", devolucion_rechazada: "Dev. rechazada",
};

const ORDER_BADGE_COLOR: Record<string, string> = {
  pendiente: "bg-muted text-foreground", aprobado: "bg-primary-soft text-primary",
  despachado: "bg-accent text-accent-foreground", recibido: "bg-success/15 text-success",
  administrado: "bg-emerald-200 text-emerald-800", rechazado: "bg-destructive/10 text-destructive",
};

const TRANSFER_STATUS_LABEL: Record<string, string> = {
  solicitado: "Solicitado", autorizado: "Autorizado", despachado: "Despachado",
  recibir: "A recibir", recibido: "Recibido", aceptado: "Aceptado", rechazado: "Rechazado",
};

const TRANSFER_BADGE_COLOR: Record<string, string> = {
  solicitado: "bg-muted text-foreground", autorizado: "bg-primary-soft text-primary",
  despachado: "bg-accent text-accent-foreground", recibir: "bg-blue-100 text-blue-700",
  recibido: "bg-success/15 text-success", aceptado: "bg-emerald-200 text-emerald-800",
  rechazado: "bg-destructive/10 text-destructive",
};

const PIPELINE_COLORS: Record<string, string> = {
  solicitado: "var(--color-chart-4)", autorizado: "var(--color-chart-1)",
  despachado: "var(--color-chart-2)", recibir: "var(--color-chart-3)",
  recibido: "var(--color-success)", aceptado: "var(--color-success)",
  rechazado: "var(--color-destructive)",
};

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  ingreso: "Ingreso", egreso: "Egreso", transferencia: "Transferencia",
  venta: "Venta", dispensacion: "Dispensación", ajuste: "Ajuste",
};

function toLocalDateInput(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function resolveWh(
  id: string,
  warehouses: Warehouse[],
  workspaces: { id: string; name: string }[],
) {
  const wh = warehouses.find((w) => w.id === id);
  if (!wh) return `Depósito ${id.slice(0, 6)}…`;
  const ws = workspaces.find((ws) => ws.id === wh.workspace_id);
  return ws ? `${ws.name} - ${wh.name}` : wh.name;
}

function resolveMed(id: string, medications: Medication[]) {
  const med = medications.find((m) => m.id === id);
  if (!med) return `Medicamento ${id.slice(0, 6)}…`;
  return `${med.name} ${med.concentration_value}${med.concentration_unit}`;
}

const TRENDS_PERIOD_DAYS = Number(import.meta.env?.TRENDS_PERIOD_DAYS ?? 30);

export function BackofficeRealtimePanel({ workspaces }: { workspaces: { id: string; name: string }[] }) {
  const [subTab, setSubTab] = useState<SubTab>("stock");
  const [data, setData] = useState<RealtimeData | null>(null);
  const [crossStock, setCrossStock] = useState<CrossHospitalMedStock[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWs, setSelectedWs] = useState<string>("__all__");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: simData, trends: simTrends, getDelta } = useSimulation(data, trends);

  async function loadData(wsId: string) {
    try {
      const { backofficeGetRealtimeDataRpc, backofficeGetConsumptionTrendsRpc, backofficeGetCrossHospitalStockRpc } = await import("@/lib/server-rpc");
      const [result, trendsResult, crossStockResult] = await Promise.all([
        backofficeGetRealtimeDataRpc({
          data: { workspaceId: wsId === "__all__" ? undefined : wsId },
        }),
        backofficeGetConsumptionTrendsRpc({
          data: {
            periodDays: TRENDS_PERIOD_DAYS,
            workspaceId: wsId === "__all__" ? undefined : wsId,
          },
        }),
        backofficeGetCrossHospitalStockRpc(),
      ]);
      setData(result as RealtimeData);
      setCrossStock(crossStockResult as CrossHospitalMedStock[]);
      setTrends(trendsResult as TrendItem[]);
      setTrendsLoading(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(selectedWs);
    intervalRef.current = setInterval(() => loadData(selectedWs), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedWs]);

  const batches = simData?.batches ?? [];
  const movements = simData?.movements ?? [];
  const orders = simData?.orders ?? [];
  const transfers = simData?.transfers ?? [];
  const warehouses = simData?.warehouses ?? [];
  const medications = simData?.medications ?? [];

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-sm font-medium">Panel en tiempo real</span>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedWs} onValueChange={(v) => { setLoading(true); setSelectedWs(v); }}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las Instituciones</SelectItem>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <DeltaCtx.Provider value={getDelta}>
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            {SUB_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="stock" className="mt-4">
            <StockTab batches={batches} warehouses={warehouses} crossStock={crossStock} stockConfig={data?.stockConfig ?? []} selectedWs={selectedWs} workspaces={workspaces} loading={loading} />
          </TabsContent>
          <TabsContent value="movements" className="mt-4">
            <MovementsTab movements={movements} medications={medications} loading={loading} />
          </TabsContent>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab orders={orders} medications={medications} loading={loading} />
          </TabsContent>
          <TabsContent value="transfers" className="mt-4">
            <TransfersTab transfers={transfers} medications={medications} warehouses={warehouses} workspaces={workspaces} loading={loading} />
          </TabsContent>
          <TabsContent value="trends" className="mt-4">
            <TrendsTab trends={simTrends} loading={trendsLoading || loading} periodDays={TRENDS_PERIOD_DAYS} />
          </TabsContent>
        </Tabs>
      </DeltaCtx.Provider>
    </div>
  );
}

function StockTab({ batches, warehouses, crossStock, stockConfig, selectedWs, workspaces, loading }: {
  batches: Batch[];
  warehouses: Warehouse[];
  crossStock: CrossHospitalMedStock[];
  stockConfig: StockConfig[];
  selectedWs: string;
  workspaces: { id: string; name: string }[];
  loading: boolean;
}) {
  const totalUnits = batches.reduce((acc, b) => acc + b.quantity, 0);
  const criticalBatches = batches.filter((b) => ["vencido", "critico"].includes(expiryStatus(b.expiry)));
  const expiringSoon = batches.filter((b) => {
    const status = expiryStatus(b.expiry);
    return status === "critico" || status === "vencido";
  });
  const getDelta = useContext(DeltaCtx);
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  const medicationList = useMemo(() => {
    if (selectedWs === "__all__") {
      return crossStock.map((med) => ({
        medicationName: med.medicationName,
        salePrice: med.salePrice,
        totalStock: med.stocks.reduce((s, st) => s + st.quantity, 0),
        totalMin: med.stocks.reduce((s, st) => s + st.minStock, 0),
        totalOpt: med.stocks.reduce((s, st) => s + st.optimalStock, 0),
        breakdown: med.stocks
          .map((st) => ({
            name: st.workspaceName,
            quantity: st.quantity,
            minStock: st.minStock,
            optimalStock: st.optimalStock,
          }))
          .filter((s) => s.quantity > 0 || s.minStock > 0),
      }));
    }
    const wsWhIds = new Set(warehouses.filter((w) => w.workspace_id === selectedWs).map((w) => w.id));
    return crossStock
      .filter((med) => med.stocks.some((s) => s.workspaceId === selectedWs))
      .map((med) => {
        const wsStock = med.stocks.find((s) => s.workspaceId === selectedWs)!;
        const medBatches = batches.filter((b) => b.medication_id === wsStock.medicationId && wsWhIds.has(b.warehouse_id));
        const whQtys: Record<string, number> = {};
        for (const b of medBatches) whQtys[b.warehouse_id] = (whQtys[b.warehouse_id] ?? 0) + b.quantity;
        const breakdown = warehouses
          .filter((w) => w.workspace_id === selectedWs)
          .map((wh) => {
            const qty = whQtys[wh.id] ?? 0;
            const cfg = stockConfig.find((sc) => sc.medication_id === wsStock.medicationId && sc.warehouse_id === wh.id);
            return { name: wh.name, quantity: qty, minStock: cfg?.min_stock ?? 0, optimalStock: cfg?.optimal_stock ?? 0 };
          })
          .filter((s) => s.quantity > 0 || s.minStock > 0);
        return {
          medicationName: med.medicationName,
          salePrice: med.salePrice,
          totalStock: breakdown.reduce((s, b) => s + b.quantity, 0),
          totalMin: breakdown.reduce((s, b) => s + b.minStock, 0),
          totalOpt: breakdown.reduce((s, b) => s + b.optimalStock, 0),
          breakdown,
        };
      });
  }, [crossStock, selectedWs, warehouses, batches, stockConfig]);

  const stockByWarehouse = warehouses
    .map((w) => ({
      name: w.name,
      value: batches.filter((b) => b.warehouse_id === w.id).reduce((acc, b) => acc + b.quantity, 0),
    }))
    .filter((w) => w.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Unidades totales", icon: Package,
            hint: "Suma de todos los lotes", tone: undefined },
          { label: "Lotes vencidos o críticos", icon: AlertTriangle,
            hint: criticalBatches.length === 0 ? "Sin lotes problemáticos" : "Requieren acción",
            tone: "warning" as const },
          { label: "Vencen próximamente (≤30d)", icon: CalendarClock,
            hint: "Lotes con vencimiento en los próximos 30 días",
            tone: expiringSoon.length > 0 ? "warning" as const : undefined },
        ].map((s, idx) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {idx === 0 ? (
                      <SimValue value={totalUnits} delta={getDelta("total-units")} format={(n) => n.toLocaleString("es-AR")} />
                    ) : idx === 1 ? (
                      <SimValue value={criticalBatches.length} delta={getDelta("critical-batches")} />
                    ) : (
                      <SimValue value={expiringSoon.length} delta={getDelta("expiring-soon")} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                  s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Stock por depósito
          </CardTitle></CardHeader>
          <CardContent>
            {stockByWarehouse.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin stock.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stockByWarehouse} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString("es-AR"), "Unidades"]} contentStyle={{ borderRadius: "0.5rem" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stockByWarehouse.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Stock por medicamento
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : medicationList.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin datos de stock.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Óptimo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicationList.map((med) => {
                  const isExpanded = expandedMed === med.medicationName;
                  return (
                    <Fragment key={med.medicationName}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandedMed(isExpanded ? null : med.medicationName)}
                      >
                        <TableCell className="text-muted-foreground">
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </TableCell>
                        <TableCell className="font-medium">{med.medicationName}</TableCell>
                        <TableCell className="text-right font-semibold">{med.totalStock.toLocaleString("es-AR")}</TableCell>
                        <TableCell className="text-right">{med.totalMin.toLocaleString("es-AR")}</TableCell>
                        <TableCell className="text-right">{med.totalOpt.toLocaleString("es-AR")}</TableCell>
                        <TableCell>
                          <StockBadge stock={med.totalStock} min={med.totalMin} opt={med.totalOpt} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && med.breakdown.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="pl-12">
                                    {selectedWs === "__all__" ? "Hospital" : "Depósito"}
                                  </TableHead>
                                  <TableHead className="text-right">Stock</TableHead>
                                  <TableHead className="text-right">Mínimo</TableHead>
                                  <TableHead className="text-right">Óptimo</TableHead>
                                  <TableHead>Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {med.breakdown.map((br) => (
                                  <TableRow key={br.name}>
                                    <TableCell className="pl-12 font-medium">{br.name}</TableCell>
                                    <TableCell className="text-right">{br.quantity.toLocaleString("es-AR")}</TableCell>
                                    <TableCell className="text-right">{br.minStock.toLocaleString("es-AR")}</TableCell>
                                    <TableCell className="text-right">{br.optimalStock.toLocaleString("es-AR")}</TableCell>
                                    <TableCell>
                                      <StockBadge stock={br.quantity} min={br.minStock} opt={br.optimalStock} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StockBadge({ stock, min, opt }: { stock: number; min: number; opt: number }) {
  if (stock < min) return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Crítico</Badge>;
  if (stock < opt) return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Bajo</Badge>;
  return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Ok</Badge>;
}

function MovementsTab({ movements, medications, loading }: { movements: Movement[]; medications: Medication[]; loading: boolean }) {
  const getDelta = useContext(DeltaCtx);
  const { isMobile, viewMode, setViewMode } = useMobileListView("bo-panel-movements");
  const [startDate, setStartDate] = useState(toLocalDateInput(-13));
  const [endDate, setEndDate] = useState(toLocalDateInput(0));

  const filtered = movements.filter((m) => {
    const d = new Date(m.date);
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const ingressCount = filtered.filter((m) => m.type === "ingreso").length;
  const egressCount = filtered.filter((m) =>
    ["venta", "dispensacion", "transferencia", "ajuste"].includes(m.type)).length;

  const dailyMovements = (() => {
    const start = new Date(startDate); const end = new Date(endDate);
    const days: Record<string, { date: string; ingreso: number; egreso: number }> = {};
    const current = new Date(start);
    while (current <= end) {
      const key = current.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
      days[key] = { date: key, ingreso: 0, egreso: 0 };
      current.setDate(current.getDate() + 1);
    }
    for (const m of filtered) {
      const key = new Date(m.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
      if (!days[key]) continue;
      if (m.type === "ingreso") days[key].ingreso += m.quantity;
      else days[key].egreso += m.quantity;
    }
    return Object.values(days);
  })();

  const dateRangeLabel = startDate === endDate
    ? new Date(startDate).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    : `del ${new Date(startDate).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} al ${
        new Date(endDate).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <Card className="mb-6 border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Desde</span>
            <input type="date" value={startDate}
              onChange={(e) => { if (e.target.value > endDate) setEndDate(e.target.value); setStartDate(e.target.value); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
            <span className="text-xs text-muted-foreground">→</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Hasta</span>
            <input type="date" value={endDate}
              onChange={(e) => { if (e.target.value < startDate) setStartDate(e.target.value); setEndDate(e.target.value); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Ingresos", icon: ArrowDownToLine, hint: `Recepciones ${dateRangeLabel}` },
          { label: "Salidas", icon: ArrowUpFromLine,
            hint: `Ventas, dispensaciones, transferencias y ajustes ${dateRangeLabel}`,
            tone: egressCount > 0 ? "destructive" as const : undefined },
          { label: "Total movimientos", icon: TrendingUp, hint: `Todos los movimientos ${dateRangeLabel}` },
        ].map((s, idx) => (
          <Card key={s.label} className={s.tone === "destructive" ? "border-destructive/30" : "border-border/60"}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className={`mt-2 text-3xl font-semibold tracking-tight ${s.tone === "destructive" ? "text-destructive" : ""}`}>
                    {idx === 0 ? (
                      <SimValue value={ingressCount} delta={getDelta("ingress-count")} />
                    ) : idx === 1 ? (
                      <SimValue value={egressCount} delta={getDelta("egress-count")} />
                    ) : (
                      <SimValue value={filtered.length} delta={getDelta("total-movements")} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                  s.tone === "destructive" ? "bg-destructive/10 text-destructive" :
                  s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Movimientos diarios
          </CardTitle></CardHeader>
          <CardContent>
            {dailyMovements.every((d) => d.ingreso === 0 && d.egreso === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyMovements} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                  <Area type="monotone" dataKey="ingreso" name="Ingresos" stroke="var(--color-success)"
                    fill="var(--color-success)" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="egreso" name="Egresos" stroke="var(--color-destructive)"
                    fill="var(--color-destructive)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Últimos movimientos
            </CardTitle>
            {isMobile && <MobileViewToggle value={viewMode} onChange={setViewMode} />}
          </CardHeader>
          <CardContent className="px-0">
            {filtered.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin movimientos.</p>
            ) : isMobile && viewMode === "cards" ? (
              <div className="space-y-3 px-4 pb-4">
                {filtered.slice(0, 10).map((m) => (
                  <Card key={m.id} className="shadow-sm">
                    <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize text-foreground">
                          {MOVEMENT_TYPE_LABEL[m.type] ?? m.type}
                        </span>
                        <span className="font-semibold text-foreground">{m.quantity} u</span>
                      </div>
                      <p>Medicamento: <span className="font-medium text-foreground">{resolveMed(m.medication_id, medications)}</span></p>
                      <p>Usuario: <span className="font-medium text-foreground">{m.user_name}</span></p>
                      <p>{formatDate(m.date)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Medicamento</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 10).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell><span className="text-xs font-medium capitalize text-muted-foreground">
                        {MOVEMENT_TYPE_LABEL[m.type] ?? m.type}</span></TableCell>
                      <TableCell className="font-medium"><span className="text-sm">{resolveMed(m.medication_id, medications)}</span></TableCell>
                      <TableCell className="text-right font-semibold">{m.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.user_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(m.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OrdersTab({ orders, medications, loading }: { orders: Order[]; medications: Medication[]; loading: boolean }) {
  const getDelta = useContext(DeltaCtx);
  const { isMobile, viewMode, setViewMode } = useMobileListView("bo-panel-orders");
  const pendingOrders = orders.filter((o) => o.status === "pendiente");
  const approvedOrders = orders.filter((o) => o.status === "aprobado");
  const rejectedOrders = orders.filter((o) => o.status === "rechazado");
  const activeOrders = orders.filter((o) => o.status === "pendiente" || o.status === "aprobado");

  const ordersByStatus = (() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const label = ORDER_STATUS_LABEL[o.status] ?? o.status;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const ordersByRoom = (() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      if (o.status === "rechazado") continue;
      const room = o.room || "Sin sala";
      counts[room] = (counts[room] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  })();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Pendientes", icon: ClipboardList, hint: "Pedidos sin procesar" },
          { label: "Aprobados", icon: CheckCircle2, hint: "Pedidos aprobados listos para despachar" },
          { label: "Rechazados", icon: XCircle, hint: "Pedidos rechazados",
            tone: rejectedOrders.length > 0 ? "warning" as const : undefined },
        ].map((s, idx) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {idx === 0 ? (
                      <SimValue value={pendingOrders.length} delta={getDelta("pending-orders")} />
                    ) : idx === 1 ? (
                      <SimValue value={approvedOrders.length} delta={getDelta("approved-orders")} />
                    ) : (
                      <SimValue value={rejectedOrders.length} delta={getDelta("rejected-orders")} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                  s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Pedidos por estado
          </CardTitle></CardHeader>
          <CardContent>
            {ordersByStatus.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin pedidos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ordersByStatus} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Pedidos por sala
          </CardTitle></CardHeader>
          <CardContent>
            {ordersByRoom.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin pedidos activos por sala.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={ordersByRoom} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {ordersByRoom.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {ordersByRoom.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {ordersByRoom.slice(0, 5).map((r, i) => (
                  <div key={r.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {r.name}: {r.value}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Pedidos activos
            {activeOrders.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeOrders.length}</Badge>}
          </CardTitle>
          {isMobile && <MobileViewToggle value={viewMode} onChange={setViewMode} />}
        </CardHeader>
        <CardContent className="px-0">
          {activeOrders.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay pedidos activos.</p>
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 px-4 pb-4">
              {activeOrders.slice(0, 10).map((o) => (
                <Card key={o.id} className="shadow-sm">
                  <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{o.patient}</p>
                      <Badge variant="outline" className={`capitalize ${ORDER_BADGE_COLOR[o.status] ?? ""}`}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </div>
                    <p>Medicamento: <span className="font-medium text-foreground">{resolveMed(o.medication_id, medications)}</span></p>
                    <p>Cantidad: <span className="font-medium text-foreground">{o.quantity} u</span></p>
                    <p>Doctor: {o.doctor} · Sala: {o.room}</p>
                    <p>Solicitud: {formatDate(o.requested_at)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitud</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOrders.slice(0, 10).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.patient}</TableCell>
                    <TableCell>{resolveMed(o.medication_id, medications)}</TableCell>
                    <TableCell className="text-right font-semibold">{o.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{o.doctor}</TableCell>
                    <TableCell className="text-muted-foreground">{o.room}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${ORDER_BADGE_COLOR[o.status] ?? ""}`}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.requested_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TransfersTab({ transfers, medications, warehouses, workspaces, loading }: { transfers: Transfer[]; medications: Medication[]; warehouses: Warehouse[]; workspaces: { id: string; name: string }[]; loading: boolean }) {
  const getDelta = useContext(DeltaCtx);
  const { isMobile, viewMode, setViewMode } = useMobileListView("bo-panel-transfers");
  const activeTransfers = transfers.filter((t) => !["aceptado", "rechazado"].includes(t.status));
  const toReceiveTransfers = transfers.filter((t) => t.status === "recibir" || t.status === "despachado");
  const todayStr = new Date().toDateString();
  const completedToday = transfers.filter(
    (t) => (t.status === "aceptado" || t.status === "rechazado") && new Date(t.date).toDateString() === todayStr,
  ).length;

  const transferPipeline = (() => {
    const counts: Record<string, number> = {};
    for (const t of transfers) {
      const label = TRANSFER_STATUS_LABEL[t.status] ?? t.status;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    const order = ["Solicitado", "Autorizado", "Despachado", "A recibir", "Recibido", "Aceptado", "Rechazado"];
    return order.filter((s) => counts[s]).map((name) => ({ name, value: counts[name] ?? 0 }));
  })();

  const transfersByDestination = (() => {
    const counts: Record<string, number> = {};
    for (const t of transfers) {
      const name = resolveWh(t.to_warehouse_id, warehouses, workspaces);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Transferencias activas", icon: ArrowLeftRight,
            hint: activeTransfers.length === 0 ? "Sin transferencias en curso" : "Solicitadas o en tránsito" },
          { label: "Pendientes de recepción", icon: PackageCheck,
            hint: "Despachadas o listas para recibir",
            tone: toReceiveTransfers.length > 0 ? "warning" as const : undefined },
          { label: "Completadas hoy", icon: CircleCheckBig, hint: "Aceptadas o rechazadas en el día" },
        ].map((s, idx) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {idx === 0 ? (
                      <SimValue value={activeTransfers.length} delta={getDelta("active-transfers")} />
                    ) : idx === 1 ? (
                      <SimValue value={toReceiveTransfers.length} delta={getDelta("to-receive-transfers")} />
                    ) : (
                      <SimValue value={completedToday} delta={getDelta("completed-today")} />
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                  s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4 text-primary" /> Pipeline de transferencias
          </CardTitle></CardHeader>
          <CardContent>
            {transferPipeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin transferencias.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={transferPipeline} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {transferPipeline.map((entry) => (
                      <Cell key={entry.name} fill={PIPELINE_COLORS[entry.name.toLowerCase()] ?? "var(--color-chart-1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4 text-primary" /> Transferencias por destino
          </CardTitle></CardHeader>
          <CardContent>
            {transfersByDestination.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin transferencias.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={transfersByDestination} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {transfersByDestination.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {transfersByDestination.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {transfersByDestination.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4 text-primary" /> Transferencias activas
          </CardTitle>
          {isMobile && <MobileViewToggle value={viewMode} onChange={setViewMode} />}
        </CardHeader>
        <CardContent className="px-0">
          {activeTransfers.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin transferencias activas.</p>
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 px-4 pb-4">
              {activeTransfers.map((t) => (
                <Card key={t.id} className="shadow-sm">
                  <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{resolveMed(t.medication_id, medications)}</p>
                      <span className="font-mono text-[10px]">{t.transfer_code ?? "—"}</span>
                    </div>
                    <p>Origen: {resolveWh(t.from_warehouse_id, warehouses, workspaces)} → Destino: {resolveWh(t.to_warehouse_id, warehouses, workspaces)}</p>
                    <div className="flex items-center justify-between">
                      <span>Cantidad: <span className="font-medium text-foreground">{t.quantity} u</span></span>
                      <Badge variant="outline" className={`capitalize ${TRANSFER_BADGE_COLOR[t.status] ?? ""}`}>
                        {TRANSFER_STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </div>
                    <p>Solicitó: {t.requested_by} · {formatDate(t.date)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitó</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTransfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs font-medium">{t.transfer_code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{resolveMed(t.medication_id, medications)}</TableCell>
                    <TableCell className="text-muted-foreground">{resolveWh(t.from_warehouse_id, warehouses, workspaces)}</TableCell>
                    <TableCell className="text-muted-foreground">{resolveWh(t.to_warehouse_id, warehouses, workspaces)}</TableCell>
                    <TableCell className="text-right font-semibold">{t.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${TRANSFER_BADGE_COLOR[t.status] ?? ""}`}>
                        {TRANSFER_STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.requested_by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(t.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const RISK_LABEL: Record<string, string> = {
  critico: "Crítico",
  bajo: "Bajo",
  optimo: "Óptimo",
  superavit: "Superávit",
  sin_stock: "Sin stock",
  sin_consumo: "Sin consumo",
};

const RISK_COLOR: Record<string, string> = {
  critico: "bg-destructive/10 text-destructive border-destructive/30",
  bajo: "bg-warning/10 text-warning border-warning/30",
  optimo: "bg-success/10 text-success border-success/30",
  superavit: "bg-primary-soft text-primary border-primary/20",
  sin_stock: "bg-muted text-muted-foreground border-border",
  sin_consumo: "bg-muted text-muted-foreground border-border",
};

function TrendsTab({ trends, loading, periodDays }: { trends: TrendItem[]; loading: boolean; periodDays: number }) {
  const getDelta = useContext(DeltaCtx);
  const categories = ["critico", "bajo", "optimo", "superavit", "sin_stock", "sin_consumo"] as const;
  const counts = categories.reduce(
    (acc, cat) => {
      acc[cat] = trends.filter((t) => t.risk_category === cat).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const cardInfo = [
    { key: "critico", label: "Críticos", icon: AlertTriangle, value: counts.critico, hint: "Se agotan en menos de 30 días", tone: "destructive" as const },
    { key: "bajo", label: "Bajos", icon: CalendarClock, value: counts.bajo, hint: "30 a 60 días de stock", tone: "warning" as const },
    { key: "optimo", label: "Óptimos", icon: CheckCircle2, value: counts.optimo, hint: "60 a 120 días de stock", tone: "success" as const },
    { key: "superavit", label: "Superávit", icon: TrendingUp, value: counts.superavit, hint: "Más de 120 días de stock", tone: "primary" as const },
  ];

  return (
    <>
      <div className="mb-3 text-xs text-muted-foreground">
        Consumo promedio diario calculado con datos de los últimos <span className="font-semibold">{periodDays} días</span>.
        {typeof import.meta !== "undefined" && import.meta.env?.TRENDS_PERIOD_DAYS && <span> Variable de entorno <code className="rounded bg-muted px-1">TRENDS_PERIOD_DAYS</code>={periodDays}.</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {cardInfo.map((c) => (
          <Card key={c.key} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    <SimValue value={c.value} delta={getDelta(`trend-${c.key}`)} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md ${
                  c.tone === "destructive" ? "bg-destructive/10 text-destructive" :
                  c.tone === "warning" ? "bg-warning/15 text-warning" :
                  c.tone === "success" ? "bg-success/15 text-success" :
                  "bg-primary-soft text-primary"
                }`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Proyección de stock por medicamento
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Calculando tendencias…</p>
          ) : trends.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin datos de consumo en el período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Stock actual</TableHead>
                  <TableHead className="text-right">Consumo/día</TableHead>
                  <TableHead className="text-right">Días restantes</TableHead>
                  <TableHead>Riesgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.map((t) => (
                  <TableRow key={t.medication_id}>
                    <TableCell className="font-medium">{t.medication_name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      <SimValue value={t.stock_total} delta={getDelta(`trend-stock-${t.medication_id}`)} format={(n) => n.toLocaleString("es-AR")} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{t.consumed_per_day.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {t.days_until_empty !== null ? (
                        t.days_until_empty < 365 ? (
                          <SimValue value={Math.floor(t.days_until_empty)} delta={getDelta(`trend-days-${t.medication_id}`)} format={(n) => `${n} días`} />
                        ) : (
                          "> 1 año"
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${RISK_COLOR[t.risk_category] ?? ""}`}>
                        {RISK_LABEL[t.risk_category] ?? t.risk_category}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
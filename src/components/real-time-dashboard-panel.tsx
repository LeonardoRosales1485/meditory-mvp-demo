import { Activity, ArrowLeftRight, Package, AlertTriangle, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { expiryStatus } from "@/lib/domain-types";
import { DashboardStockTab } from "@/components/dashboard-stock-tab";
import { DashboardMovementsTab } from "@/components/dashboard-movements-tab";
import { DashboardOrdersTab } from "@/components/dashboard-orders-tab";
import { DashboardTransfersTab } from "@/components/dashboard-transfers-tab";

type SubTab = "stock" | "movements" | "orders" | "transfers";

const SUB_TABS = [
  { value: "stock", label: "Stock" },
  { value: "movements", label: "Movimientos" },
  { value: "orders", label: "Pedidos" },
  { value: "transfers", label: "Transferencias" },
] as const;

export function RealTimeDashboardPanel() {
  const { warehouseIds } = useWarehouse();
  const batches = useStore((s) => s.batches).filter((b) => warehouseIds.includes(b.warehouseId));
  const movements = useStore((s) => s.movements).filter((m) => warehouseIds.includes(m.warehouseId));
  const orders = useStore((s) => s.orders).filter((o) => warehouseIds.includes(o.warehouseId));
  const transfers = useStore((s) => s.transfers).filter(
    (t) => warehouseIds.includes(t.fromWarehouseId) || warehouseIds.includes(t.toWarehouseId),
  );
  const warehouses = useStore((s) => s.warehouses);

  const totalUnits = batches.reduce((acc, b) => acc + b.quantity, 0);
  const criticalBatches = batches.filter((b) => ["vencido", "critico"].includes(expiryStatus(b.expiry)));
  const pendingTransfers = transfers.filter((t) => !["aceptado", "rechazado"].includes(t.status));
  const pendingOrders = orders.filter((o) => o.status === "pendiente" || o.status === "aprobado");

  const summaryCards = [
    { label: "Unidades en stock", value: totalUnits.toLocaleString("es-AR"), icon: Package,
      hint: totalUnits === 0 ? "Sin unidades" : "Suma de lotes visibles" },
    { label: "Vencimientos críticos", value: String(criticalBatches.length), icon: AlertTriangle,
      hint: criticalBatches.length === 0 ? "Nada crítico" : "Próximos 30 días o vencido", tone: "warning" as const },
    { label: "Transferencias activas", value: String(pendingTransfers.length), icon: ArrowLeftRight,
      hint: pendingTransfers.length === 0 ? "Sin transferencias en curso" : "Solicitadas o en tránsito" },
    { label: "Pedidos pendientes", value: String(pendingOrders.length), icon: ShoppingCart,
      hint: pendingOrders.length === 0 ? "Sin pedidos pendientes" : "Pendientes o aprobados" },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Vista en vivo</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{s.hint}</p>
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  s.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          {SUB_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="stock" className="mt-3">
          <DashboardStockTab batches={batches} warehouses={warehouses} />
        </TabsContent>
        <TabsContent value="movements" className="mt-3">
          <DashboardMovementsTab movements={movements} warehouses={warehouses} />
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <DashboardOrdersTab orders={orders} warehouses={warehouses} />
        </TabsContent>
        <TabsContent value="transfers" className="mt-3">
          <DashboardTransfersTab transfers={transfers} warehouses={warehouses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

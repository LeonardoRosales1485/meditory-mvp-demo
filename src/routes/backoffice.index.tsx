import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, Users, Package, Warehouse, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { useBackofficeStore } from "@/lib/backoffice-store";
import { useMobileListView } from "@/lib/use-mobile-list-view";

export const Route = createFileRoute("/backoffice/")({
  beforeLoad: () => { throw redirect({ to: "/backoffice/estado-hospital" }); },
  component: BackofficeDashboardPage,
});

const CHART_COLORS = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)",
];

interface InstitucionStat {
  id: string; name: string; slug: string;
  totalUnits: number; totalBatches: number; totalUsers: number;
  totalWarehouses: number; movementsToday: number; salesToday: number;
  activeOrders: number;
}

interface DashboardData {
  workspaces: InstitucionStat[];
  totalWorkspaces: number;
  totalUsers: number;
  totalWarehouses: number;
  totalBatches: number;
  totalUnits: number;
  recentMovements: {
    id: string; workspace_id?: string; type: string;
    medication_id: string; quantity: number; user_name: string; date: string;
  }[];
}

function BackofficeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isMobile, viewMode, setViewMode } = useMobileListView("backoffice-dashboard");

  useEffect(() => {
    async function load() {
      try {
        const { backofficeGetDashboardDataRpc } = await import("@/lib/server-rpc");
        const result = await backofficeGetDashboardDataRpc();
        setData(result as DashboardData);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const wsChartData = useMemo(() => {
    if (!data) return [];
    return data.workspaces.map((ws) => ({
      name: ws.name.split(" ")[0],
      unidades: ws.totalUnits,
      usuarios: ws.totalUsers,
      depositos: ws.totalWarehouses,
    }));
  }, [data]);

  const wsPieData = useMemo(() => {
    if (!data) return [];
    return data.workspaces.map((ws, i) => ({
      name: ws.name,
      value: ws.totalUnits,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Cargando dashboard global…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const globalStats = [
    { label: "Instituciones", value: String(data.totalWorkspaces), icon: Building2 },
    { label: "Usuarios", value: String(data.totalUsers), icon: Users },
    { label: "Depósitos", value: String(data.totalWarehouses), icon: Warehouse },
    { label: "Unidades en stock", value: data.totalUnits.toLocaleString("es-AR"), icon: Package },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Dashboard global</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {globalStats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-institucion comparison */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" /> Unidades por Institución
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wsChartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={wsChartData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
                  <Bar dataKey="unidades" radius={[0, 4, 4, 0]} fill="var(--color-chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Distribución de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={wsPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={2}
                >
                  {wsPieData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "0.5rem" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {wsPieData.map((e, i) => (
                <div key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                  {e.name}: {e.value.toLocaleString("es-AR")}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla resumen por Institución */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Resumen por Institución
          </CardTitle>
          {isMobile && <MobileViewToggle value={viewMode} onChange={setViewMode} />}
        </CardHeader>
        <CardContent className="px-0">
          {isMobile && viewMode === "cards" ? (
            <div className="space-y-3 px-4 pb-4">
              {data.workspaces.map((ws) => (
                <Card key={ws.id} className="shadow-sm">
                  <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                    <p>Depósitos: <span className="font-medium text-foreground">{ws.totalWarehouses}</span></p>
                    <p>Usuarios: <span className="font-medium text-foreground">{ws.totalUsers}</span></p>
                    <p>Unidades: <span className="font-medium text-foreground">{ws.totalUnits.toLocaleString("es-AR")}</span></p>
                    <p>Lotes: <span className="font-medium text-foreground">{ws.totalBatches}</span></p>
                    <p>Mov. hoy: <span className="font-medium text-foreground">{ws.movementsToday}</span></p>
                    <p>Ventas hoy: <span className="font-medium text-foreground">{ws.salesToday}</span></p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institución</TableHead>
                  <TableHead className="text-right">Depósitos</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Lotes</TableHead>
                  <TableHead className="text-right">Mov. hoy</TableHead>
                  <TableHead className="text-right">Ventas hoy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.workspaces.map((ws) => (
                  <TableRow key={ws.id}>
                    <TableCell className="font-medium">{ws.name}</TableCell>
                    <TableCell className="text-right">{ws.totalWarehouses}</TableCell>
                    <TableCell className="text-right">{ws.totalUsers}</TableCell>
                    <TableCell className="text-right font-semibold">{ws.totalUnits.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right">{ws.totalBatches}</TableCell>
                    <TableCell className="text-right">{ws.movementsToday}</TableCell>
                    <TableCell className="text-right">{ws.salesToday}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Movimientos recientes (global)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {data.recentMovements.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin movimientos.</p>
          ) : isMobile && viewMode === "cards" ? (
            <div className="space-y-3 px-4 pb-4">
              {data.recentMovements.slice(0, 15).map((m) => (
                <Card key={m.id} className="shadow-sm">
                  <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                      <span className="font-semibold text-foreground">{m.quantity} u</span>
                    </div>
                    <p>Usuario: <span className="font-medium text-foreground">{m.user_name}</span></p>
                    <p>
                      {new Date(m.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentMovements.slice(0, 15).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.user_name}</TableCell>
                    <TableCell className="text-right font-semibold">{m.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

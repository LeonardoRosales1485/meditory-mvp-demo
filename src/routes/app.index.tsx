import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Package,
  AlertTriangle,
  ArrowLeftRight,
  ShoppingCart,
  TrendingUp,
  Clock,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";

import { AppRealtimePanel } from "@/components/app-realtime-panel";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpiryBadge } from "@/components/expiry-badge";
import { StatusBadge } from "@/components/status-badge";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { expiryStatus, formatDate, medName, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const [view, setView] = useState<"general" | "analitica">("general");
  const { warehouseIds } = useWarehouse();
  const session = useStore((s) => s.session);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const batches = useStore((s) => s.batches).filter((b) => warehouseIds.includes(b.warehouseId));
  const movements = useStore((s) => s.movements).filter((m) => warehouseIds.includes(m.warehouseId));
  const transferRequests = useStore((s) => s.transfers).filter(
    (t) => warehouseIds.includes(t.fromWarehouseId) || warehouseIds.includes(t.toWarehouseId),
  );
  const sales = useStore((s) => s.sales);
  const total = batches.reduce((acc, b) => acc + b.quantity, 0);
  const critical = batches.filter((b) => ["vencido", "critico"].includes(expiryStatus(b.expiry)));
  const pending = transferRequests.filter((t) => !["aceptado", "rechazado"].includes(t.status));
  const recent = [...movements].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5);
  const today = new Date().toDateString();
  const salesToday = sales.filter((s) => new Date(s.date).toDateString() === today).length;

  const showInitialLoading = workspaceDataLoading && batches.length === 0;

  const stats = [
    {
      label: "Unidades en stock",
      value: total.toLocaleString("es-AR"),
      icon: Package,
      hint: total === 0 && !showInitialLoading ? "Sin unidades en los depósitos visibles" : "Suma de lotes en depósitos del rol",
    },
    {
      label: "Vencimientos críticos",
      value: String(critical.length),
      icon: AlertTriangle,
      hint: critical.length === 0 && !showInitialLoading ? "Nada próximo a vencer ni vencido en este rango" : "Próximos 30 días o vencidos",
      tone: "warning" as const,
    },
    {
      label: "Transferencias activas",
      value: String(pending.length),
      icon: ArrowLeftRight,
      hint: pending.length === 0 && !showInitialLoading ? "No hay solicitudes en curso" : "Solicitadas o en tránsito",
    },
    {
      label: "Ventas hoy",
      value: String(salesToday),
      icon: ShoppingCart,
      hint: salesToday === 0 && !showInitialLoading ? "Sin ventas registradas hoy" : "Conteo del día en farmacia ventas",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Panel general"
        description={`Resumen operativo de la Institución ${session?.workspaceName ?? ""}.`}
      />
      <div className="mb-6 flex gap-2">
        <Button
          variant={view === "general" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("general")}
        >
          <LayoutDashboard className="mr-1.5 h-4 w-4" />
          Vista general
        </Button>
        <Button
          variant={view === "analitica" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("analitica")}
        >
          <BarChart3 className="mr-1.5 h-4 w-4" />
          Vista analítica
        </Button>
      </div>

      {view === "general" ? (
        <>
      {showInitialLoading ? (
        <WorkspaceLoadingPlaceholder
          title="Cargando panel"
          description="Obteniendo stock, movimientos y transferencias…"
        />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-md ${
                    s.tone === "warning"
                      ? "bg-warning/15 text-warning"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Movimientos recientes
            </CardTitle>
            <Link to="/app/auditoria" className="text-xs text-primary hover:underline">
              Ver auditoría
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {workspaceDataLoading && recent.length === 0 ? (
              <div className="px-6 py-8">
                <WorkspaceLoadingPlaceholder title="Cargando movimientos" description="Un momento…" />
              </div>
            ) : recent.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No hay movimientos recientes en los depósitos seleccionados.
              </p>
            ) : (
            <ul className="divide-y">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{medName(m.medicationId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.type} · {warehouseName(m.warehouseId)} · {m.user}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{m.quantity}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Vencimientos críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {workspaceDataLoading && critical.length === 0 ? (
              <div className="px-6 py-8">
                <WorkspaceLoadingPlaceholder title="Cargando vencimientos" description="Un momento…" />
              </div>
            ) : critical.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No hay lotes críticos ni vencidos en los depósitos visibles.
              </p>
            ) : (
            <ul className="divide-y">
              {critical.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{medName(b.medicationId)}</p>
                    <p className="text-xs text-muted-foreground">
                      Lote {b.lot} · {warehouseName(b.warehouseId)}
                    </p>
                  </div>
                  <ExpiryBadge expiry={b.expiry} />
                </li>
              ))}
            </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Transferencias en curso
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {workspaceDataLoading && pending.length === 0 ? (
            <div className="px-6 py-8">
              <WorkspaceLoadingPlaceholder title="Cargando transferencias" description="Un momento…" />
            </div>
          ) : pending.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No hay transferencias pendientes (solicitadas o en tránsito).
            </p>
          ) : (
          <ul className="divide-y">
            {pending.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{medName(t.medicationId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {warehouseName(t.fromWarehouseId)} → {warehouseName(t.toWarehouseId)} · {t.quantity} u
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
          )}
        </CardContent>
      </Card>
        </>
      )}
        </>
      ) : (
        <AppRealtimePanel />
      )}
    </div>
  );
}
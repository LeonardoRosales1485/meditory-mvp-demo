import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCw, BarChart3, Table, Calculator, Warehouse, Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiRow } from "@/components/dashboard-kpi-cards";
import {
  StackedBarChart,
  StockDonutChart,
  HospitalRadarChart,
  ConsumptionAreaChart,
  TopMedsHorizontalChart,
  StockVsDemandChart,
  StockTreemap,
  StockHeatmap,
  LossSankeyChart,
  CapacityDonutChart,
  type WorkspaceStat,
} from "@/components/dashboard-charts";
import { StockCrossTable } from "@/components/stock-cross-table";
import { LossCalculator } from "@/components/loss-calculator";
import { WarehouseVolumeSection } from "@/components/warehouse-volume-card";
import { StockConfigDialog } from "@/components/stock-config-dialog";
import type { CrossHospitalMedStock, LossCalculationResult, WarehouseVolumeItem, ConsumptionDataPoint } from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/estado-hospital")({
  component: EstadoHospitalPage,
});

async function loadAllData() {
  const {
    backofficeGetCrossHospitalStockRpc,
    backofficeGetLossCalculationRpc,
    backofficeGetWarehouseVolumeDataRpc,
    backofficeGetConsumptionByMedicationRpc,
    backofficeGetDashboardDataRpc,
  } = await import("@/lib/server-rpc");

  const [crossStock, lossData, volumeData, consumptionData, dashboardData] = await Promise.all([
    backofficeGetCrossHospitalStockRpc(),
    backofficeGetLossCalculationRpc(),
    backofficeGetWarehouseVolumeDataRpc(),
    backofficeGetConsumptionByMedicationRpc({ data: { periodDays: 30 } }),
    backofficeGetDashboardDataRpc(),
  ]);

  return {
    crossStock: crossStock as CrossHospitalMedStock[],
    lossData: lossData as LossCalculationResult,
    volumeData: volumeData as WarehouseVolumeItem[],
    consumptionData: consumptionData as ConsumptionDataPoint[],
    dashboardData: dashboardData as { workspaces: WorkspaceStat[]; totalUnits: number },
  };
}

function EstadoHospitalPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAllData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [editConfig, setEditConfig] = useState<{
    medicationId: string;
    warehouseId: string;
    medicationName: string;
    warehouseName: string;
    workspaceName: string;
    qty: number;
    min: number;
    opt: number;
  } | null>(null);

  const [selectedWs, setSelectedWs] = useState<string>("__all__");

  const fetchData = async () => {
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
  };

  useEffect(() => { fetchData(); }, []);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // ── Filter state (always called – same hook order on every render) ──
  const workspaces: WorkspaceStat[] = data?.dashboardData?.workspaces ?? [];
  const selectedWsName = selectedWs === "__all__" ? null : workspaces.find((ws) => ws.id === selectedWs)?.name ?? null;

  const filteredCrossStock = useMemo(() => {
    if (!data || selectedWs === "__all__") return (data?.crossStock ?? []) as CrossHospitalMedStock[];
    return (data.crossStock as CrossHospitalMedStock[])
      .map((m) => ({
        ...m,
        stocks: m.stocks.filter((s) => s.workspaceName === selectedWsName),
      }))
      .filter((m) => m.stocks.length > 0) as CrossHospitalMedStock[];
  }, [data, selectedWs, selectedWsName]);

  const filteredVolumeData = useMemo(() => {
    if (!data || selectedWs === "__all__") return (data?.volumeData ?? []) as WarehouseVolumeItem[];
    return (data.volumeData as WarehouseVolumeItem[]).filter((v) => v.workspaceName === selectedWsName);
  }, [data, selectedWs, selectedWsName]);

  const filteredConsumptionData = useMemo(() => {
    if (!data || selectedWs === "__all__") return (data?.consumptionData ?? []) as ConsumptionDataPoint[];
    return (data.consumptionData as ConsumptionDataPoint[]).filter((c) => c.workspaceName === selectedWsName);
  }, [data, selectedWs, selectedWsName]);

  const filteredWorkspaces = useMemo(() => {
    if (!data || selectedWs === "__all__") return workspaces;
    return workspaces.filter((ws) => ws.id === selectedWs);
  }, [data, selectedWs, workspaces]);

  const filteredWorkspaceNames = filteredWorkspaces.map((ws) => ws.name);
  const filteredWarehouseSummary = filteredVolumeData.slice(0, 9).map((wh) => ({ name: wh.name, pct: wh.occupancyPct }));
  const filteredTotalUnits = filteredWorkspaces.reduce((s, ws) => s + ws.totalUnits, 0);
  const filteredCriticalMeds = filteredCrossStock.filter((m) =>
    m.stocks.some((s) => s.minStock > 0 && s.quantity < s.minStock)
  ).length;

  // ── Early returns (no new hooks below this line) ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Activity size={40} className="text-primary" />
        </motion.div>
        <p className="text-muted-foreground">Cargando estado del hospital…</p>
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

  const { crossStock, lossData, volumeData, consumptionData, dashboardData } = data;
  const topWs = [...workspaces].sort((a, b) => b.totalUnits - a.totalUnits)[0];
  const topWsUnits = topWs?.totalUnits ?? 0;
  const topWsName = topWs?.name ?? "Hospital";

  const handleExportPdf = async () => {
    try {
      const mod = await import("@/lib/pdf-generator");
      await mod.generateDashboardSnapshotPdf("estado-hospital-dashboard");
    } catch (e) {
      toast.error("No se pudo descargar el PDF", { description: "Ocurrió un error al generar el documento." });
    }
  };

  return (
    <div id="estado-hospital-dashboard" className="space-y-8 pb-12" style={{ scrollBehavior: "smooth" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-primary" size={26} />
            Estado general
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedWs === "__all__" ? "Visión consolidada de los 3 hospitales" : selectedWsName} · Actualizado ahora
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw size={14} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Navegación rápida */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => scrollToSection("section-charts")} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md active:scale-95">
          <BarChart3 size={14} /> Gráficos
        </button>
        <button onClick={() => scrollToSection("section-stock-table")} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md active:scale-95">
          <Table size={14} /> Stock Cruzado
        </button>
        <button onClick={() => scrollToSection("section-loss-calc")} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md active:scale-95">
          <Calculator size={14} /> Pérdidas
        </button>
        <button onClick={() => scrollToSection("section-warehouses")} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md active:scale-95">
          <Warehouse size={14} /> Depósitos
        </button>
      </div>

      {/* KPIs */}
      <div id="section-kpis">
        <KpiRow
        totalUnits={filteredTotalUnits}
        lossWithoutTransfers={lossData.totalLossWithoutTransfers}
        savingWithTransfers={lossData.totalSavingWithTransfers}
        criticalMeds={filteredCriticalMeds}
        topWsUnits={selectedWs === "__all__" ? topWsUnits : filteredTotalUnits}
        topWsName={topWsName}
        selectedWorkspaceName={selectedWsName}
      />
      </div>

      {/* Grid de 12 gráficos */}
      <div id="section-charts">
        <h2 className="text-lg font-semibold mb-4">Análisis Visual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StackedBarChart crossStock={filteredCrossStock} workspaces={filteredWorkspaces} />
          <StockDonutChart workspaces={filteredWorkspaces} />
          <HospitalRadarChart workspaces={filteredWorkspaces} />
          <ConsumptionAreaChart data={filteredConsumptionData} />
          <TopMedsHorizontalChart crossStock={filteredCrossStock} />
          <StockVsDemandChart crossStock={filteredCrossStock} />
          <StockTreemap crossStock={filteredCrossStock} />
          <StockHeatmap crossStock={filteredCrossStock} workspaceNames={filteredWorkspaceNames} />
          <LossSankeyChart
            totalStock={filteredTotalUnits}
            lossAmount={lossData.totalLossWithoutTransfers}
            savingAmount={lossData.totalSavingWithTransfers}
          />
          <CapacityDonutChart warehouses={filteredWarehouseSummary} />
        </div>
      </div>

      {/* Tabla Stock Cruzado */}
      <div id="section-stock-table">
        <StockCrossTable
          data={filteredCrossStock}
          workspaceNames={filteredWorkspaceNames}
          onExportPdf={handleExportPdf}
          onEditConfig={(medicationId, warehouseId, medicationName, workspaceName, qty, min, opt) =>
            setEditConfig({ medicationId, warehouseId, medicationName, warehouseName: workspaceName, workspaceName, qty, min, opt })
          }
        />
      </div>

      {/* Calculadora de pérdidas */}
      <div id="section-loss-calc">
        <LossCalculator
          lossData={lossData}
          medicationNames={[...new Set(lossData.byMedication.map((m) => m.medicationName))]}
        />
      </div>

      {/* Depósitos por capacidad */}
      <div id="section-warehouses">
        <WarehouseVolumeSection warehouses={filteredVolumeData} />
      </div>

      {editConfig && (
        <StockConfigDialog
          open={!!editConfig}
          onOpenChange={(open) => { if (!open) setEditConfig(null); }}
          medicationName={editConfig.medicationName}
          warehouseName={editConfig.warehouseName}
          workspaceName={editConfig.workspaceName}
          currentMin={editConfig.min}
          currentOpt={editConfig.opt}
          currentQty={editConfig.qty}
          onSave={async (minStock, optimalStock) => {
            const { backofficeUpdateStockConfigRpc } = await import("@/lib/server-rpc");
            await backofficeUpdateStockConfigRpc({
              data: {
                medicationId: editConfig.medicationId,
                warehouseId: editConfig.warehouseId,
                minStock,
                optimalStock,
              },
            });
            await fetchData();
          }}
        />
      )}
    </div>
  );
}

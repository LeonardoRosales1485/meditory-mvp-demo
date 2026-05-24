import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCw, BarChart3, Table, Calculator, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const workspaces: WorkspaceStat[] = dashboardData.workspaces ?? [];
  const workspaceNames = workspaces.map((ws) => ws.name);

  const totalUnits = workspaces.reduce((s, ws) => s + ws.totalUnits, 0);
  const alemanWs = workspaces.find((ws) => ws.id === "ws-aleman");
  const alemanUnits = alemanWs?.totalUnits ?? 0;
  const criticalMeds = crossStock.filter((m) =>
    m.stocks.some((ws) => ws.minStock > 0 && ws.quantity < ws.minStock)
  ).length;

  const warehouseSummary = volumeData.slice(0, 9).map((wh) => ({ name: wh.name, pct: wh.occupancyPct }));

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
            Visión consolidada de los 3 hospitales · Actualizado ahora
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw size={14} /> Actualizar
        </Button>
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
        totalUnits={totalUnits}
        lossWithoutTransfers={lossData.totalLossWithoutTransfers}
        savingWithTransfers={lossData.totalSavingWithTransfers}
        criticalMeds={criticalMeds}
        alemanUnits={alemanUnits}
      />
      </div>

      {/* Grid de 12 gráficos */}
      <div id="section-charts">
        <h2 className="text-lg font-semibold mb-4">Análisis Visual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StackedBarChart crossStock={crossStock} workspaces={workspaces} />
          <StockDonutChart workspaces={workspaces} />
          <HospitalRadarChart workspaces={workspaces} />
          <ConsumptionAreaChart data={consumptionData} />
          <TopMedsHorizontalChart crossStock={crossStock} />
          <StockVsDemandChart crossStock={crossStock} />
          <StockTreemap crossStock={crossStock} />
          <StockHeatmap crossStock={crossStock} workspaceNames={workspaceNames} />
          <LossSankeyChart
            totalStock={totalUnits}
            lossAmount={lossData.totalLossWithoutTransfers}
            savingAmount={lossData.totalSavingWithTransfers}
          />
          <CapacityDonutChart warehouses={warehouseSummary} />
        </div>
      </div>

      {/* Tabla Stock Cruzado */}
      <div id="section-stock-table">
        <StockCrossTable
          data={crossStock}
          workspaceNames={workspaceNames}
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
        <WarehouseVolumeSection warehouses={volumeData} />
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

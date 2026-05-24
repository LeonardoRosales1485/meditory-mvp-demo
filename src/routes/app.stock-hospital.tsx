import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockCrossTable } from "@/components/stock-cross-table";
import { useStore } from "@/lib/store";
import { generateStockReportPdf } from "@/lib/pdf-generator";
import type { CrossHospitalMedStock } from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/app/stock-hospital")({
  component: StockHospitalPage,
});

function StockHospitalPage() {
  const session = useStore((s) => s.session);
  const [crossStock, setCrossStock] = useState<CrossHospitalMedStock[]>([]);
  const [workspaceNames, setWorkspaceNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const { backofficeGetCrossHospitalStockRpc } = await import("@/lib/server-rpc");
      const data = await backofficeGetCrossHospitalStockRpc() as CrossHospitalMedStock[];

      // Filtrar al workspace del usuario si no es admin multi-hospital
      const allWsNames = [...new Set(data.flatMap((m) => m.stocks.map((s) => s.workspaceName)))];
      setWorkspaceNames(allWsNames);
      setCrossStock(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function handleExportPdf() {
    generateStockReportPdf({
      rows: crossStock.map((m) => ({
        medicationName: m.medicationName,
        stocks: m.stocks.map((s) => ({
          workspaceName: s.workspaceName,
          quantity: s.quantity,
          minStock: s.minStock,
          optimalStock: s.optimalStock,
        })),
      })),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Cargando stock cruzado…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-600">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-primary" size={24} />
            <div>
              <h1 className="text-xl font-bold">Stock Cruzado por Hospital</h1>
              <p className="text-sm text-muted-foreground">Comparativa de inventario entre los 3 hospitales</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw size={14} /> Actualizar
          </Button>
        </div>
      </motion.div>

      <StockCrossTable
        data={crossStock}
        workspaceNames={workspaceNames}
        onExportPdf={handleExportPdf}
      />
    </div>
  );
}

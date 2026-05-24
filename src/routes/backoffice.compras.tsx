import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, FileDown, Search, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { CrossHospitalMedStock, ProcurementResult } from "@/lib/server/backoffice-service";
import { generateOrderPdf } from "@/lib/pdf-generator";

export const Route = createFileRoute("/backoffice/compras")({
  component: ComprasPage,
});

function ComprasPage() {
  const [allMeds, setAllMeds] = useState<CrossHospitalMedStock[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [result, setResult] = useState<ProcurementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [initialized, setInitialized] = useState(false);

  async function loadMeds() {
    if (initialized) return;
    setLoadingMeds(true);
    try {
      const { backofficeGetCrossHospitalStockRpc } = await import("@/lib/server-rpc");
      const data = await backofficeGetCrossHospitalStockRpc() as CrossHospitalMedStock[];
      setAllMeds(data);
      setInitialized(true);
    } finally {
      setLoadingMeds(false);
    }
  }

  async function handleSelect(medName: string) {
    setSelected(medName);
    setLoading(true);
    try {
      const { backofficeGetProcurementOptimizationRpc } = await import("@/lib/server-rpc");
      const data = await backofficeGetProcurementOptimizationRpc({ data: { medicationName: medName } }) as ProcurementResult[];
      setResult(data.find((d) => d.medicationName === medName) ?? data[0] ?? null);
    } finally {
      setLoading(false);
    }
  }

  const filteredMeds = allMeds.filter((m) => m.medicationName.toLowerCase().includes(search.toLowerCase()));

  function handleExport() {
    if (!result) return;
    try {
      const items = result.items.map((item) => ({
        medicationName: result.medicationName,
        workspaceName: item.workspaceName,
        quantityWithoutTransfers: item.orderWithoutTransfers,
        quantityWithTransfers: item.orderWithTransfers,
        unitPrice: result.salePrice,
        subtotalWithoutTransfers: item.costWithoutTransfers,
        subtotalWithTransfers: item.costWithTransfers,
      }));
      generateOrderPdf({
        items,
        totalWithoutTransfers: result.totalCostWithoutTransfers,
        totalWithTransfers: result.totalCostWithTransfers,
        totalSaving: result.totalSaving,
        generatedAt: new Date().toLocaleString("es-AR"),
      });
    } catch (e) {
      toast.error("No se pudo descargar el PDF", { description: "Ocurrió un error al generar el documento." });
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <ShoppingCart className="text-primary" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Compras / Licitación</h1>
            <p className="text-sm text-muted-foreground">Optimizá los pedidos a proveedores con transferencias internas</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izq: selector */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Seleccionar Medicamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar medicamento..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); loadMeds(); }}
                  onFocus={loadMeds}
                  className="pl-8 text-sm"
                />
              </div>

              {loadingMeds && (
                <p className="text-xs text-muted-foreground text-center py-2">Cargando...</p>
              )}

              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredMeds.map((med) => (
                  <button
                    key={med.medicationName}
                    onClick={() => handleSelect(med.medicationName)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selected === med.medicationName
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{med.medicationName}</div>
                    <div className={`text-xs mt-0.5 ${selected === med.medicationName ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      ${med.salePrice.toLocaleString("es-AR")} / unidad ·{" "}
                      {med.stocks.reduce((s, ws) => s + ws.quantity, 0).toLocaleString("es-AR")} uds total
                    </div>
                  </button>
                ))}
                {filteredMeds.length === 0 && initialized && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                )}
                {!initialized && !loadingMeds && (
                  <p className="text-xs text-muted-foreground text-center py-4">Hacé click en el campo para cargar los medicamentos</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel der: resultados */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {!selected && !loading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3"
              >
                <ShoppingCart size={40} className="opacity-30" />
                <p className="text-sm">Seleccioná un medicamento para ver la optimización de compra</p>
              </motion.div>
            )}

            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-64 text-muted-foreground"
              >
                <p className="text-sm">Calculando optimización...</p>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key={result.medicationName}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Métricas grandes */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-red-600 mb-1">
                        <TrendingDown size={16} />
                        <span className="text-xs font-medium">Sin transferencias</span>
                      </div>
                      <p className="text-2xl font-black text-red-700 dark:text-red-400">
                        ${result.totalCostWithoutTransfers.toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Cada hospital pide su déficit completo</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <TrendingUp size={16} />
                        <span className="text-xs font-medium">Con transferencias internas</span>
                      </div>
                      <p className="text-2xl font-black text-green-700 dark:text-green-400">
                        ${result.totalCostWithTransfers.toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        AHORRO: <strong className="text-green-700">${result.totalSaving.toLocaleString("es-AR")}</strong>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla detalle */}
                <Card>
                  <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-sm">{result.medicationName}</CardTitle>
                      <p className="text-xs text-muted-foreground">Precio: ${result.salePrice.toLocaleString("es-AR")} / unidad</p>
                    </div>
                    <Button size="sm" onClick={handleExport} className="gap-1.5 h-8 text-xs">
                      <FileDown size={13} /> Descargar PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Hospital</TableHead>
                          <TableHead className="text-xs text-right">Stock actual</TableHead>
                          <TableHead className="text-xs text-right">Mínimo</TableHead>
                          <TableHead className="text-xs text-right">Óptimo</TableHead>
                          <TableHead className="text-xs text-right">Déficit</TableHead>
                          <TableHead className="text-xs text-right">Sin transfers</TableHead>
                          <TableHead className="text-xs text-right">Con transfers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.items.map((item) => (
                          <TableRow key={item.workspaceId}>
                            <TableCell className="text-sm font-medium">{item.workspaceName}</TableCell>
                            <TableCell className="text-right text-sm">{item.currentStock.toLocaleString("es-AR")}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{item.minStock.toLocaleString("es-AR")}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{item.optimalStock.toLocaleString("es-AR")}</TableCell>
                            <TableCell className="text-right text-sm">
                              {item.deficit > 0
                                ? <Badge variant="destructive" className="text-xs">{item.deficit.toLocaleString("es-AR")}</Badge>
                                : item.surplus > 0
                                ? <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">+{item.surplus.toLocaleString("es-AR")}</Badge>
                                : <Badge variant="outline" className="text-xs">OK</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-right text-sm text-red-600 font-medium">
                              {item.orderWithoutTransfers > 0 ? item.orderWithoutTransfers.toLocaleString("es-AR") : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-green-600 font-medium">
                              {item.orderWithTransfers > 0 ? item.orderWithTransfers.toLocaleString("es-AR") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Fila total */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="text-sm font-bold">TOTAL OPTIMIZADO</TableCell>
                          <TableCell className="text-right text-sm">{result.items.reduce((s, i) => s + i.currentStock, 0).toLocaleString("es-AR")}</TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right text-sm">{result.items.reduce((s, i) => s + i.deficit, 0).toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">
                            ${result.totalCostWithoutTransfers.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-right text-sm text-green-600">
                            ${result.totalCostWithTransfers.toLocaleString("es-AR")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
                  <strong>¿Por qué importa?</strong> Sin transferencias internas, cada hospital licita su stock completo aunque otro tenga sobrestock. Redistribuir el sobrestock antes de la licitación evita comprar lo que ya existe en el sistema. En este medicamento, el ahorro es <strong>${result.totalSaving.toLocaleString("es-AR")}</strong>.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

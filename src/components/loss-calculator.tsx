import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingDown, TrendingUp, ArrowRight, RefreshCw, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { LossCalculationResult } from "@/lib/server/backoffice-service";

interface LossCalculatorProps {
  lossData: LossCalculationResult;
  medicationNames: string[];
}

function BigNumber({ value, label, color, prefix = "$" }: { value: number; label: string; color: "red" | "green"; prefix?: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 text-center ${color === "red" ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-green-300 bg-green-50 dark:bg-green-950/30"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-3xl font-black ${color === "red" ? "text-red-600" : "text-green-600"}`}>
        {prefix}{value.toLocaleString("es-AR")}
      </p>
    </div>
  );
}

export function LossCalculator({ lossData, medicationNames }: LossCalculatorProps) {
  const [selectedMed, setSelectedMed] = useState<string>("all");
  const [showTransfers, setShowTransfers] = useState(false);

  const filtered = selectedMed === "all"
    ? lossData.byMedication
    : lossData.byMedication.filter((m) => m.medicationName === selectedMed);

  const totalLoss = filtered.reduce((s, m) => s + m.currentLoss, 0);
  const totalSaving = filtered.reduce((s, m) => s + m.potentialSaving, 0);
  const effectiveLoss = showTransfers ? totalLoss - totalSaving : totalLoss;

  function handleDownloadPdf() {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, pageW, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Calculadora de Pérdidas por Licitación", pageW / 2, 18, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Meditory — Sistema de Gestión Farmacéutica", pageW / 2, 28, { align: "center" });
      doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, pageW / 2, 35, { align: "center" });

      y = 52;
      doc.setTextColor(30, 30, 30);

      doc.setFillColor(254, 243, 199);
      doc.roundedRect(14, y, pageW - 28, 28, 3, 3, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Resumen", 20, y + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Pérdida actual (sin transfers): $${effectiveLoss.toLocaleString("es-AR")}`, 20, y + 16);
      doc.setTextColor(34, 197, 94);
      doc.text(`Ahorro potencial con transfers: $${totalSaving.toLocaleString("es-AR")}`, 20, y + 22);
      doc.setTextColor(30, 30, 30);

      y += 40;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Detalle por medicamento", 14, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      for (const item of filtered) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${item.medicationName}: ${item.surplusHospital} +${item.surplusQuantity} → ${item.deficitHospital} -${item.deficitQuantity}  -$${item.currentLoss.toLocaleString("es-AR")}`, 14, y);
        y += 5;
      }

      doc.save(`perdidas-licitacion-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("Error generating loss PDF:", e);
      toast.error("No se pudo generar el PDF");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Calculadora de Pérdidas por Licitación</CardTitle>
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedMed} onValueChange={setSelectedMed}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Medicamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los medicamentos</SelectItem>
                {medicationNames.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownloadPdf}>
              <FileDown size={12} className="mr-1" />PDF
            </Button>
            <Button
              variant={showTransfers ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowTransfers(!showTransfers)}
            >
              {showTransfers ? "Con transfers ✓" : "Sin transfers"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={showTransfers ? "with" : "without"}
            initial={{ opacity: 0, x: showTransfers ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: showTransfers ? -10 : 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <BigNumber
              value={effectiveLoss}
              label={showTransfers ? "Pérdida residual (con transfers)" : "PÉRDIDA ACTUAL (sin transfers)"}
              color="red"
            />
            <BigNumber
              value={totalSaving}
              label="Ahorro potencial con transfers"
              color="green"
            />
          </motion.div>
        </AnimatePresence>

        {filtered.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground">Detalle por medicamento</p>
            {filtered.slice(0, 8).map((item, i) => (
              <motion.div
                key={`${item.medicationName}-${item.surplusHospital}-${item.deficitHospital}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2"
              >
                <span className="font-medium truncate flex-1">{item.medicationName}</span>
                <div className="flex items-center gap-1 text-blue-600 shrink-0">
                  <span className="text-muted-foreground">{item.surplusHospital.split(" ")[1]}</span>
                  <span className="text-green-600">+{item.surplusQuantity}</span>
                </div>
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1 text-red-600 shrink-0">
                  <span className="text-muted-foreground">{item.deficitHospital.split(" ")[1]}</span>
                  <span>-{item.deficitQuantity}</span>
                </div>
                <span className="text-red-600 font-bold shrink-0">-${item.currentLoss.toLocaleString("es-AR")}</span>
              </motion.div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <RefreshCw size={24} className="mx-auto mb-2 opacity-40" />
            No hay desequilibrios de stock para este medicamento
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
          <strong>¿Qué es esto?</strong> Cada hospital licita su stock de forma independiente. El Hospital Alemán acumula sobrestock mientras otros hospitales tienen faltantes. Con transferencias internas, el sobrestock se redistribuye antes de licitar, ahorrando <strong>${totalSaving.toLocaleString("es-AR")}</strong> en compras innecesarias.
        </div>
      </CardContent>
    </Card>
  );
}

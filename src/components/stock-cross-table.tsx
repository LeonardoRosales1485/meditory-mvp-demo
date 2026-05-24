import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrossHospitalMedStock } from "@/lib/server/backoffice-service";

interface StockCrossTableProps {
  data: CrossHospitalMedStock[];
  workspaceNames: string[];
  onExportPdf?: () => void;
  onEditConfig?: (medicationId: string, warehouseId: string, medicationName: string, workspaceName: string, qty: number, min: number, opt: number) => void;
}

function cellClass(qty: number, minStock: number, optimalStock: number): string {
  if (optimalStock === 0) return "bg-muted text-muted-foreground";
  if (qty === 0) return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold";
  if (qty < minStock) return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300";
  if (qty >= minStock && qty <= optimalStock) return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300";
  return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300";
}

function StockCell({ qty, minStock, optimalStock, medicationId, warehouseId, medicationName, workspaceName, onEditConfig }: {
  qty: number; minStock: number; optimalStock: number;
  medicationId?: string; warehouseId?: string; medicationName?: string; workspaceName?: string;
  onEditConfig?: (medicationId: string, warehouseId: string, medicationName: string, workspaceName: string, qty: number, min: number, opt: number) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cls = cellClass(qty, minStock, optimalStock);
  const diff = qty - optimalStock;

  return (
    <td className="px-3 py-1.5 text-right relative">
      <div className="flex items-center justify-end gap-1">
        <div
          className={`rounded px-2 py-0.5 text-xs font-medium cursor-default ${cls}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {qty.toLocaleString("es-AR")}
          {showTooltip && (
            <div className="absolute right-0 top-full z-50 w-44 bg-popover border rounded-lg shadow-lg p-2 text-xs text-left mt-1">
              <p className="font-semibold mb-1 text-foreground">Detalles</p>
              <p className="text-muted-foreground">Actual: <span className="text-foreground font-medium">{qty.toLocaleString("es-AR")}</span></p>
              <p className="text-muted-foreground">Mínimo: <span className="text-foreground font-medium">{minStock.toLocaleString("es-AR")}</span></p>
              <p className="text-muted-foreground">Óptimo: <span className="text-foreground font-medium">{optimalStock.toLocaleString("es-AR")}</span></p>
              <p className={`font-medium mt-1 ${diff >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {diff >= 0 ? `+${diff.toLocaleString("es-AR")} superávit` : `${diff.toLocaleString("es-AR")} déficit`}
              </p>
            </div>
          )}
        </div>
        {onEditConfig && medicationId && warehouseId && (
          <button
            onClick={() => onEditConfig(medicationId, warehouseId, medicationName ?? '', workspaceName ?? '', qty, minStock, optimalStock)}
            className="invisible group-hover:visible p-0.5 rounded hover:bg-muted transition-colors"
            title="Configurar stock mínimo/óptimo"
          >
            <Pencil size={12} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </td>
  );
}

export function StockCrossTable({ data, workspaceNames, onExportPdf, onEditConfig }: StockCrossTableProps) {
  const [search, setSearch] = useState("");

  const filtered = data.filter((m) =>
    m.medicationName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold text-base">Stock Cruzado por Hospital</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-block w-3 h-3 rounded bg-green-200 mr-1" />Óptimo
            <span className="inline-block w-3 h-3 rounded bg-red-200 ml-2 mr-1" />Crítico
            <span className="inline-block w-3 h-3 rounded bg-blue-200 ml-2 mr-1" />Superávit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs w-36"
            />
          </div>
          {onExportPdf && (
            <Button size="sm" variant="outline" onClick={onExportPdf} className="h-8 text-xs gap-1">
              <Download size={13} /> PDF
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Medicamento</th>
              {workspaceNames.map((ws) => (
                <th key={ws} className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">{ws.split(" ").slice(1).join(" ") || ws}</th>
              ))}
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((med, idx) => {
              const total = med.stocks.reduce((s, ws) => s + ws.quantity, 0);
              return (
                  <motion.tr
                    key={med.medicationName}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b last:border-0 hover:bg-muted/40 transition-colors group"
                  >
                    <td className="px-4 py-1.5 font-medium text-sm">{med.medicationName}</td>
                    {workspaceNames.map((wsName) => {
                      const stock = med.stocks.find((s) => s.workspaceName === wsName);
                      if (!stock) return <td key={wsName} className="px-3 py-1.5 text-right text-muted-foreground text-xs">—</td>;
                      return (
                        <StockCell
                          key={wsName}
                          qty={stock.quantity}
                          minStock={stock.minStock}
                          optimalStock={stock.optimalStock}
                          medicationId={stock.medicationId}
                          warehouseId={stock.warehouseId}
                          medicationName={med.medicationName}
                          workspaceName={wsName}
                          onEditConfig={onEditConfig}
                        />
                      );
                    })}
                  <td className="px-3 py-1.5 text-right font-bold text-sm">{total.toLocaleString("es-AR")}</td>
                </motion.tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={workspaceNames.length + 2} className="text-center py-8 text-muted-foreground text-sm">
                  Sin resultados para "{search}"
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur">
              <tr className="border-t">
                <td className="px-4 py-2 text-xs font-bold">TOTAL GLOBAL</td>
                {workspaceNames.map((wsName) => {
                  const wsTotal = filtered.reduce((s, med) => {
                    const stock = med.stocks.find((ws) => ws.workspaceName === wsName);
                    return s + (stock?.quantity ?? 0);
                  }, 0);
                  return (
                    <td key={wsName} className="px-3 py-2 text-right text-xs font-bold">
                      {wsTotal.toLocaleString("es-AR")}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right text-xs font-bold">
                  {filtered.reduce((s, med) => s + med.stocks.reduce((ss, ws) => ss + ws.quantity, 0), 0).toLocaleString("es-AR")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </motion.div>
  );
}

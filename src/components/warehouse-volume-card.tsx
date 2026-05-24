import { motion } from "framer-motion";
import { Warehouse, Download } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadElementAsPng } from "@/lib/utils";
import type { WarehouseVolumeItem } from "@/lib/server/backoffice-service";

function ProgressBar({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const color = pct < 60 ? "bg-green-500" : pct < 85 ? "bg-yellow-500" : "bg-red-500";
  const track = pct < 60 ? "bg-green-100 dark:bg-green-950" : pct < 85 ? "bg-yellow-100 dark:bg-yellow-950" : "bg-red-100 dark:bg-red-950";

  return (
    <div className={`h-2 rounded-full ${track} overflow-hidden`}>
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: "0%" }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay, ease: "easeOut" }}
      />
    </div>
  );
}

function WarehouseItem({ wh, delay }: { wh: WarehouseVolumeItem; delay: number }) {
  const pctColor = wh.occupancyPct < 60 ? "text-green-600" : wh.occupancyPct < 85 ? "text-yellow-600" : "text-red-600";
  const typeLabel = wh.type === "central" ? "Central" : wh.type === "interna" ? "Interna" : "Ventas";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{wh.name}</span>
        <span className={`font-bold ${pctColor}`}>{wh.occupancyPct.toFixed(0)}%</span>
      </div>
      <ProgressBar pct={wh.occupancyPct} delay={delay} />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{wh.currentUnits.toLocaleString("es-AR")} uds</span>
        <span>Cap. {wh.maxCapacity.toLocaleString("es-AR")}</span>
      </div>
    </motion.div>
  );
}

interface WarehouseVolumeCardProps {
  warehouses: WarehouseVolumeItem[];
}

export function WarehouseVolumeSection({ warehouses }: WarehouseVolumeCardProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  async function handleDownloadImage() {
    if (!sectionRef.current) return;
    try {
      await downloadElementAsPng(sectionRef.current, "capacidad-depositos");
    } catch {
      toast.error("No se pudo descargar la imagen");
    }
  }

  const byWorkspace = warehouses.reduce<Record<string, WarehouseVolumeItem[]>>((acc, wh) => {
    if (!acc[wh.workspaceName]) acc[wh.workspaceName] = [];
    acc[wh.workspaceName].push(wh);
    return acc;
  }, {});

  const wsOrder = ["Hospital Alemán", "Hospital Francisco", "Hospital Blanco"];
  const sorted = wsOrder.filter((ws) => byWorkspace[ws]).concat(
    Object.keys(byWorkspace).filter((ws) => !wsOrder.includes(ws))
  );

  return (
    <div ref={sectionRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Warehouse size={18} className="text-muted-foreground" />
          Capacidad por Depósito
        </h3>
        <button
          onClick={handleDownloadImage}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
          title="Descargar imagen"
        >
          <Download size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sorted.map((wsName, wsIdx) => {
          const whs = byWorkspace[wsName] ?? [];
          const isAleman = wsName === "Hospital Alemán";
          const totalUnits = whs.reduce((s, wh) => s + wh.currentUnits, 0);
          const totalCap = whs.reduce((s, wh) => s + wh.maxCapacity, 0);
          const avgPct = totalCap > 0 ? (totalUnits / totalCap) * 100 : 0;

          return (
            <motion.div
              key={wsName}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: wsIdx * 0.1 }}
              className={isAleman ? "hospital-aleman-highlight rounded-xl" : ""}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{wsName}</span>
                    {isAleman && (
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full font-medium">
                        #1 Mayor Stock
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {totalUnits.toLocaleString("es-AR")} / {totalCap.toLocaleString("es-AR")} uds ({avgPct.toFixed(0)}%)
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {whs.map((wh, i) => (
                    <WarehouseItem key={wh.warehouseId} wh={wh} delay={wsIdx * 0.1 + i * 0.07} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

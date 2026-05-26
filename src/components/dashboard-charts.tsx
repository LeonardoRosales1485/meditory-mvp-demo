import { motion } from "framer-motion";
import { useRef, useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { captureChartAsDataUrl, downloadChartAsPng, downloadElementAsPng } from "@/lib/utils";
import { generateChartReportPdf } from "@/lib/pdf-generator";
import type { CrossHospitalMedStock, ConsumptionDataPoint } from "@/lib/server/backoffice-service";

interface ChartReport {
  workspaceNames: string[];
  analysis: string;
  recommendations: string[];
  tips?: string[];
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const COLORS_HEX = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#14b8a6", "#e11d48", "#a855f7",
  "#84cc16", "#0ea5e9", "#d946ef", "#ea580c", "#10b981",
];

function ChartCard({ title, children, delay = 0, report }: { title: string; children: React.ReactNode; delay?: number; report?: ChartReport }) {
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    if (!cardRef.current) return;
    if (report) {
      try {
        const chartImageData = await captureChartAsDataUrl(cardRef.current);
        await generateChartReportPdf({
          title,
          chartImageData,
          workspaceNames: report.workspaceNames,
          date: new Date().toLocaleDateString("es-AR"),
          analysis: report.analysis,
          recommendations: report.recommendations,
          tips: report.tips,
        });
      } catch (e) {
        toast.error("No se pudo descargar el reporte PDF", { description: "Ocurrió un error al generar el documento." });
      }
    } else {
      try {
        await downloadChartAsPng(cardRef.current, `chart-${title}`);
      } catch {
        try {
          await downloadElementAsPng(cardRef.current, `chart-${title}`);
        } catch {
          toast.error("No se pudo descargar el gráfico", { description: "Ocurrió un error al generar la imagen." });
        }
      }
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Card className="group relative h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <button
            onClick={handleDownload}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
            title="Descargar gráfico"
          >
            <Download size={14} />
          </button>
        </CardHeader>
        <CardContent className="pt-0"><div data-chart-content>{children}</div></CardContent>
      </Card>
    </motion.div>
  );
}

// ── Tipos de datos de entrada ────────────────────────────────

export interface WorkspaceStat {
  id: string;
  name: string;
  totalUnits: number;
  totalUsers: number;
  totalWarehouses: number;
  movementsToday: number;
}

// ── 1. BarChart apilado: Stock por hospital × medicamento ────

export function StackedBarChart({ crossStock, workspaces }: { crossStock: CrossHospitalMedStock[]; workspaces: WorkspaceStat[] }) {
  const topMeds = crossStock.slice(0, 8);
  const data = topMeds.map((med) => {
    const row: Record<string, string | number> = { name: med.medicationName.slice(0, 12) };
    for (const s of med.stocks) {
      row[s.workspaceName] = s.quantity;
    }
    return row;
  });

  const wsNames = workspaces.map((ws) => ws.name);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = workspaces.map((ws) => ws.name);
    const allTotals = topMeds.map((m) => m.stocks.reduce((s, ws) => s + ws.quantity, 0));
    const grandTotal = allTotals.reduce((a, b) => a + b, 0);
    const maxMed = topMeds.reduce((a, b) => {
      const ta = a.stocks.reduce((s, ws) => s + ws.quantity, 0);
      const tb = b.stocks.reduce((s, ws) => s + ws.quantity, 0);
      return ta > tb ? a : b;
    }, topMeds[0]);
    const maxWs = maxMed.stocks.reduce((a, b) => a.quantity > b.quantity ? a : b);
    const lowMeds = topMeds.filter((m) => m.stocks.some((s) => s.quantity < s.minStock));

    const analysis = `El gráfico de stock por hospital y medicamento revela que ${maxMed.medicationName} es el medicamento con mayor presencia, concentrando ${maxWs.quantity} unidades en ${maxWs.workspaceName}. De los ${topMeds.length} medicamentos analizados, ${lowMeds.length} presentan stock por debajo del mínimo en al menos un hospital, lo que representa un riesgo de desabastecimiento. La distribución del stock no es uniforme entre hospitales: se observan diferencias significativas en medicamentos como ${topMeds[0]?.medicationName ?? ''}, donde un hospital concentra la mayor parte del inventario mientras otros registran niveles críticamente bajos. El volumen total de stock representado asciende a ${grandTotal.toLocaleString('es-AR')} unidades, con ${allTotals.filter(t => t > 0).length} medicamentos activamente stockeados. Esta disparidad sugiere que las compras se realizan de forma descentralizada sin una visión consolidada, lo que genera ineficiencias en la asignación de recursos.`;

    const recs: string[] = [];
    if (lowMeds.length > 0) {
      recs.push(`Priorizar la compra o transferencia de ${lowMeds.map(m => m.medicationName).join(', ')} para cubrir los déficits detectados en los hospitales correspondientes.`);
    }
    recs.push('Implementar un sistema de compras centralizadas que consolide la demanda de todos los hospitales para negociar mejores precios y evitar roturas de stock.');
    recs.push('Establecer convenios de transferencia interna entre hospitales para redistribuir el excedente de medicamentos desde los centros con superávit hacia aquellos con déficit.');

    const tips: string[] = [];
    if (grandTotal > 10000) {
      tips.push('Considerar la rotación de inventario: priorizar el consumo de lotes próximos a vencer mediante redistribución entre hospitales.');
    }
    tips.push('Revisar trimestralmente los parámetros de stock mínimo y óptimo en función de los patrones de consumo reales de cada hospital.');

    return { workspaceNames: wsFullNames, analysis, recommendations: recs, tips };
  }, [crossStock, workspaces]);

  return (
    <ChartCard title="Stock por Hospital × Medicamento" delay={0} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {wsNames.map((ws, i) => (
            <Bar key={ws} dataKey={ws} stackId="a" fill={COLORS_HEX[i % COLORS_HEX.length]} isAnimationActive />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 2. PieChart donut: Distribución de stock por hospital ────

export function StockDonutChart({ workspaces }: { workspaces: WorkspaceStat[] }) {
  const data = workspaces.map((ws, i) => ({
    name: ws.name,
    value: ws.totalUnits,
    color: COLORS_HEX[i % COLORS_HEX.length],
  }));
  const total = data.reduce((s, d) => s + d.value, 0);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = workspaces.map((ws) => ws.name);
    const maxWs = data.reduce((a, b) => a.value > b.value ? a : b, data[0]);
    const minWs = data.reduce((a, b) => a.value < b.value ? a : b, data[0]);
    const diff = maxWs.value - minWs.value;
    const diffPctNum = total > 0 ? (diff / total) * 100 : 0;
    const diffPct = diffPctNum.toFixed(1);

    const analysis = `La distribución de stock entre hospitales muestra un cuadro de concentración desigual: ${maxWs.name} concentra ${maxWs.value.toLocaleString('es-AR')} unidades (${total > 0 ? ((maxWs.value / total) * 100).toFixed(1) : 0}% del total), mientras que ${minWs.name} apenas alcanza ${minWs.value.toLocaleString('es-AR')} unidades. La diferencia entre el hospital mejor y peor stockeado es de ${diff.toLocaleString('es-AR')} unidades, lo que representa un ${diffPct}% del inventario total de ${total.toLocaleString('es-AR')} unidades. Esta asimetría puede deberse a diferencias en la capacidad de almacenamiento, presupuesto asignado o volumen de pacientes. Un hospital con exceso de stock corre el riesgo de vencimientos y costos de almacenamiento innecesarios, mientras que uno con déficit compromete la continuidad de la atención.`;

    const tips: string[] = [];
    if (diffPctNum > 30) {
      tips.push('Considerar la redistribución de inventario desde el hospital con mayor concentración hacia los de menor stock para equilibrar la capacidad operativa.');
    }

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        'Evaluar la capacidad de almacenamiento y rotación de cada hospital para determinar si el desbalance responde a necesidades reales o a ineficiencias de compra.',
        `Implementar un sistema de alertas cuando la diferencia de stock entre hospitales supere el 30% del inventario total, activando automáticamente una propuesta de transferencia.`,
        'Centralizar las compras de medicamentos de alto volumen para garantizar una distribución equitativa entre todos los hospitales de la red.',
      ],
      tips,
    };
  }, [workspaces]);

  return (
    <ChartCard title="Distribución de Stock por Hospital" delay={0.05} report={report}>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize={12}>
              {total > 0 ? `${(total / 1000).toFixed(0)}K` : "0"}
            </text>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span className="shrink-0 w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
              <span className="text-xs font-medium">{total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0"}%</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ── 3. BarChart horizontal: Top 10 medicamentos más stockeados

export function TopMedsHorizontalChart({ crossStock }: { crossStock: CrossHospitalMedStock[] }) {
  const data = crossStock
    .map((m) => ({ name: m.medicationName, total: m.stocks.reduce((s, ws) => s + ws.quantity, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(crossStock.flatMap((m) => m.stocks.map((s) => s.workspaceName)))];
    const topTotal = data[0]?.total ?? 0;
    const bottomTotal = data[data.length - 1]?.total ?? 1;
    const ratio = (topTotal / bottomTotal).toFixed(1);
    const topMedsDist = data.slice(0, 3).map((m) => m.name).join(', ');
    const grandTotalTop = data.reduce((s, d) => s + d.total, 0);

    const analysis = `El ranking de los 10 medicamentos más stockeados muestra que ${data[0]?.name ?? ''} ocupa el primer lugar con ${topTotal.toLocaleString('es-AR')} unidades, superando por un factor de ${ratio}x al décimo medicamento de la lista (${data[data.length - 1]?.name ?? ''} con ${bottomTotal.toLocaleString('es-AR')} unidades). Los tres principales —${topMedsDist}— concentran una parte significativa del inventario total de ${grandTotalTop.toLocaleString('es-AR')} unidades representado en este top 10. Esta concentración en pocos medicamentos sugiere que son fármacos de alta rotación o uso crítico, por lo que merecen una atención especial en la gestión de inventario y la negociación con proveedores.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        `Negociar contratos marco con proveedores para ${data[0]?.name ?? ''} y ${data[1]?.name ?? ''} buscando descuentos por volumen, dado su alto nivel de stock.`,
        'Revisar si los medicamentos del top 10 tienen sustitutos terapéuticos equivalentes que permitan diversificar el riesgo de desabastecimiento.',
        'Evaluar la rotación real de estos medicamentos: un alto stock combinado con baja rotación indica riesgo de vencimiento.',
      ],
      tips: [
        'Aplicar el análisis ABC a todo el inventario: el 20% de los medicamentos suele representar el 80% del valor del stock.',
      ],
    };
  }, [crossStock]);

  return (
    <ChartCard title="Top 10 Medicamentos más Stockeados" delay={0.2} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={140} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS_HEX[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 6. BarChart 3 barras: Stock Actual vs Óptimo vs Crítico ──

export function StockVsDemandChart({ crossStock }: { crossStock: CrossHospitalMedStock[] }) {
  const data = crossStock.slice(0, 10).map((m) => ({
    name: m.medicationName,
    stockTotal: m.stocks.reduce((s, ws) => s + ws.quantity, 0),
    optimalTotal: m.stocks.reduce((s, ws) => s + ws.optimalStock, 0),
    minTotal: m.stocks.reduce((s, ws) => s + ws.minStock, 0),
  }));

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(crossStock.flatMap((m) => m.stocks.map((s) => s.workspaceName)))];
    const deficitMeds = data.filter((d) => d.stockTotal < d.optimalTotal);
    const surplusMeds = data.filter((d) => d.stockTotal > d.optimalTotal);
    const criticalMeds = data.filter((d) => d.stockTotal < d.minTotal);
    const totalDeficit = deficitMeds.reduce((s, d) => s + (d.optimalTotal - d.stockTotal), 0);
    const totalSurplus = surplusMeds.reduce((s, d) => s + (d.stockTotal - d.optimalTotal), 0);
    const pctOnTarget = data.length > 0 ? ((data.length - deficitMeds.length - surplusMeds.length) / data.length * 100).toFixed(0) : "0";

    const analysis = `Del total de ${data.length} medicamentos analizados, solo el ${pctOnTarget}% se encuentra dentro del rango óptimo de stock. Se identificaron ${deficitMeds.length} medicamentos con déficit (faltante total de ${totalDeficit.toLocaleString('es-AR')} unidades para alcanzar el nivel óptimo) y ${surplusMeds.length} con superávit (excedente de ${totalSurplus.toLocaleString('es-AR')} unidades). De estos, ${criticalMeds.length} medicamentos se encuentran por debajo del stock mínimo, lo que representa un riesgo inminente de desabastecimiento. Los medicamentos más críticos son: ${criticalMeds.slice(0, 3).map((m) => `${m.name} (actual: ${m.stockTotal}, óptimo: ${m.optimalTotal})`).join('; ')}. Esta brecha entre el stock actual y los niveles óptimos sugiere que los parámetros de inventario no se actualizan con la frecuencia necesaria o que las compras no se ajustan a la demanda real.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        criticalMeds.length > 0 ? `Activar compra de emergencia para: ${criticalMeds.map((m) => m.name).join(', ')}.` : '',
        deficitMeds.length > 0 && surplusMeds.length > 0 ? `Transferir excedentes de ${surplusMeds[0]?.name ?? ''} y ${surplusMeds[1]?.name ?? ''} hacia los hospitales con déficit, reduciendo la necesidad de compra externa.` : '',
        'Revisar y actualizar los parámetros de stock mínimo y óptimo cada 90 días en función del consumo real y los plazos de reposición.',
        `Implementar alertas automáticas cuando el stock caiga por debajo del 120% del stock mínimo para activar la reposición con antelación.`,
      ].filter(Boolean),
      tips: [
        totalSurplus > totalDeficit ? `El superávit total (${totalSurplus.toLocaleString('es-AR')}) supera el déficit (${totalDeficit.toLocaleString('es-AR')}); priorizar la redistribución antes que nuevas compras.` : '',
      ].filter(Boolean),
    };
  }, [crossStock]);

  return (
    <ChartCard title="Stock Actual vs Demanda Óptima" delay={0.25} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="stockTotal" name="Actual" fill="#6366f1" isAnimationActive />
          <Bar dataKey="optimalTotal" name="Óptimo" fill="#22c55e" isAnimationActive />
          <Bar dataKey="minTotal" name="Crítico" fill="#ef4444" isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 7. Treemap: Stock por categoría/medicamento ───────────────

export function StockTreemap({ crossStock }: { crossStock: CrossHospitalMedStock[] }) {
  const data = crossStock.slice(0, 15).map((m, i) => ({
    name: m.medicationName,
    size: m.stocks.reduce((s, ws) => s + ws.quantity, 0),
    fill: COLORS_HEX[i % COLORS_HEX.length],
  }));

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(crossStock.flatMap((m) => m.stocks.map((s) => s.workspaceName)))];
    const total = data.reduce((s, d) => s + d.size, 0);
    const top3 = data.slice(0, 3);
    const top3Pct = total > 0 ? (top3.reduce((s, d) => s + d.size, 0) / total * 100).toFixed(0) : "0";
    const bottom3 = data.slice(-3);

    const analysis = `La visualización de tipo treemap revela la distribución del stock entre los ${data.length} medicamentos con mayor presencia en inventario. El volumen total representado es de ${total.toLocaleString('es-AR')} unidades. Los tres medicamentos principales (${top3.map(d => d.name).join(', ')}) concentran el ${top3Pct}% del total, lo que indica una alta concentración en pocos productos. En el extremo opuesto, ${bottom3.map(d => `${d.name} (${d.size} uds)`).join(', ')} registran los niveles más bajos entre los medicamentos analizados. Esta distribución sesgada es típica en entornos hospitalarios donde unos pocos medicamentos de alto consumo dominan el inventario.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        'Enfocar los esfuerzos de negociación con proveedores en los 3 medicamentos principales, ya que representan la mayor parte del capital invertido en inventario.',
        'Monitorear semanalmente los medicamentos con menor representación para evitar que caigan en desabastecimiento total.',
        'Evaluar la posibilidad de consolidar presentaciones o concentraciones para reducir la cantidad de SKUs y simplificar la gestión de inventario.',
      ],
      tips: [
        'Utilizar el treemap como herramienta visual en las reuniones de planificación de compras para identificar rápidamente desequilibrios en la distribución del inventario.',
      ],
    };
  }, [crossStock]);

  return (
    <ChartCard title="Distribución por Medicamento (Treemap) en todos los hospitales" delay={0.3} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          aspectRatio={4 / 3}
          isAnimationActive
          // @ts-expect-error - Recharts Treemap accepts a render function but types require ReactElement
          content={({ x, y, width, height, name, fill }: any) => {
            const w = width ?? 0; const h = height ?? 0;
            if (w < 30 || h < 20) return null;
            return (
              <g>
                <rect x={x} y={y} width={w} height={h} style={{ fill, stroke: "#fff", strokeWidth: 2, opacity: 0.85 }} />
                {w > 50 && h > 24 && (
                  <text x={(x ?? 0) + w / 2} y={(y ?? 0) + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={w > 80 ? 11 : 9} fill="#fff">
                    {(name ?? "").slice(0, 10)}
                  </text>
                )}
              </g>
            );
          }}
        />
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 8. Heatmap custom: Medicamento × Hospital ─────────────────

export function StockHeatmap({ crossStock, workspaceNames }: { crossStock: CrossHospitalMedStock[]; workspaceNames: string[] }) {
  const meds = crossStock.slice(0, 8);

  function intensity(qty: number, opt: number): string {
    if (opt === 0) return "bg-muted";
    const ratio = qty / opt;
    if (ratio === 0) return "bg-red-200 dark:bg-red-900";
    if (ratio < 0.3) return "bg-red-300 dark:bg-red-800";
    if (ratio < 0.7) return "bg-orange-200 dark:bg-orange-900";
    if (ratio <= 1.1) return "bg-green-200 dark:bg-green-900";
    return "bg-green-200 dark:bg-green-900";
  }

  const report: ChartReport = useMemo(() => {
    const criticalCells: string[] = [];
    const optimalCells: string[] = [];
    for (const med of meds) {
      for (const s of med.stocks) {
        const ratio = s.optimalStock > 0 ? s.quantity / s.optimalStock : 1;
        if (ratio < 0.3) criticalCells.push(`${med.medicationName} en ${s.workspaceName} (${s.quantity} de ${s.optimalStock} óptimas)`);
        else if (ratio >= 0.7 && ratio <= 1.1) optimalCells.push(`${med.medicationName} en ${s.workspaceName}`);
      }
    }
    const wsNamesList = workspaceNames.join(', ');

    const analysis = `El heatmap de stock por medicamento y hospital proporciona una visión de semáforo del estado del inventario. Se detectaron ${criticalCells.length} celdas en estado crítico (stock por debajo del 30% del nivel óptimo): ${criticalCells.slice(0, 5).join('; ')}${criticalCells.length > 5 ? ` y ${criticalCells.length - 5} más` : ''}. Por otro lado, ${optimalCells.length} celdas se encuentran en nivel óptimo. Los hospitales analizados son: ${wsNamesList}. Esta visualización permite identificar rápidamente los puntos de mayor riesgo y las áreas que requieren atención inmediata. La presencia de múltiples celdas críticas en un mismo hospital sugiere problemas sistémicos de abastecimiento que deben abordarse de raíz.`;

    return {
      workspaceNames,
      analysis,
      recommendations: [
        criticalCells.length > 0 ? `Atender con urgencia los ${criticalCells.length} puntos críticos detectados, comenzando por aquellos donde el stock es cero o está próximo a agotarse.` : '',
        'Realizar un análisis de causa raíz para los hospitales que concentran la mayor cantidad de celdas críticas: problemas de presupuesto, logística o demanda inesperada.',
        'Configurar alertas por correo electrónico cuando un medicamento caiga por debajo del 50% de su stock óptimo en cualquier hospital.',
      ].filter(Boolean),
      tips: [
        'Usar el heatmap semanalmente en las reuniones de gestión para priorizar acciones correctivas con base en el código de colores.',
        optimalCells.length > criticalCells.length ? 'El ratio de celdas óptimas vs críticas es positivo, pero no debe llevar a la complacencia: los puntos críticos requieren acción inmediata.' : '',
      ].filter(Boolean),
    };
  }, [crossStock, workspaceNames]);

  return (
    <ChartCard title="Heatmap Stock — Medicamento × Hospital" delay={0.35} report={report}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1 pr-2 font-medium text-muted-foreground">Medicamento</th>
              {workspaceNames.map((ws) => (
                <th key={ws} className="px-1 text-center font-medium text-muted-foreground text-[10px]">{ws.split(" ").pop()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meds.map((med) => (
              <tr key={med.medicationName}>
                <td className="py-1 pr-2 font-medium truncate max-w-[90px]">{med.medicationName}</td>
                {workspaceNames.map((wsName) => {
                  const stock = med.stocks.find((s) => s.workspaceName === wsName);
                  if (!stock) return <td key={wsName} className="px-1"><div className="h-7 rounded bg-muted" /></td>;
                  return (
                    <td key={wsName} className="px-1 py-0.5">
                      <div
                        className={`h-7 rounded ${intensity(stock.quantity, stock.optimalStock)} flex items-center justify-center font-medium text-foreground/80`}
                        title={`${stock.quantity} uds (óptimo: ${stock.optimalStock})`}
                      >
                        {stock.quantity > 999 ? `${(stock.quantity / 1000).toFixed(1)}K` : stock.quantity}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {[["bg-red-300","Sin stock"], ["bg-orange-200","Crítico"], ["bg-green-200","Óptimo"]].map(([cls, label]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${cls}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ── 10. Semi-circle donut: Capacidad depósitos ───────────────

export interface WarehouseVolumeSummary { name: string; pct: number; workspaceName?: string }

export function CapacityDonutChart({ warehouses }: { warehouses: WarehouseVolumeSummary[] }) {
  const avgPct = warehouses.length > 0 ? warehouses.reduce((s, w) => s + w.pct, 0) / warehouses.length : 0;
  const color = avgPct < 60 ? "#22c55e" : avgPct < 85 ? "#f59e0b" : "#ef4444";

  const cx = 100; const cy = 100; const r = 70;
  const startAngle = 180;
  const endAngle = 180 + (avgPct / 100) * 180;

  function polar(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polar(startAngle);
  const end = polar(endAngle);
  const largeArc = avgPct >= 100 ? 1 : 0;

  function statusLabel(pct: number): string {
    if (pct < 60) return "Óptimo";
    if (pct < 85) return "Precaución";
    return "Crítico";
  }

  const report: ChartReport = useMemo(() => {
    const avgPct = warehouses.length > 0 ? warehouses.reduce((s, w) => s + w.pct, 0) / warehouses.length : 0;
    const criticalWh = warehouses.filter((w) => w.pct >= 85);
    const optimalWh = warehouses.filter((w) => w.pct < 60);
    const cautionWh = warehouses.filter((w) => w.pct >= 60 && w.pct < 85);
    const maxWh = warehouses.reduce((a, b) => a.pct > b.pct ? a : b, warehouses[0]);
    const minWh = warehouses.reduce((a, b) => a.pct < b.pct ? a : b, warehouses[0]);

    const analysis = `La capacidad promedio de los depósitos es del ${avgPct.toFixed(0)}%, lo que indica un nivel de ocupación ${avgPct >= 85 ? 'crítico que requiere expansión inmediata' : avgPct >= 60 ? 'moderado pero requiere monitoreo' : 'saludable con margen de crecimiento'}. De los ${warehouses.length} depósitos evaluados, ${criticalWh.length} están en nivel crítico (>85%), ${cautionWh.length} en precaución (60-85%) y ${optimalWh.length} en nivel óptimo (<60%). El depósito con mayor ocupación es ${maxWh.name} (${maxWh.pct.toFixed(0)}%), mientras que ${minWh.name} tiene la menor ocupación (${minWh.pct.toFixed(0)}%). Esta disparidad en los niveles de ocupación sugiere que algunos depósitos podrían estar subutilizados mientras otros operan al límite de su capacidad, lo que afecta la eficiencia logística y la conservación adecuada de los medicamentos.`;

    return {
      workspaceNames: [],
      analysis,
      recommendations: [
        criticalWh.length > 0 ? `Evaluar la expansión o redistribución de carga en los ${criticalWh.length} depósitos críticos (${criticalWh.map(w => w.name).join(', ')}) para evitar riesgos de almacenamiento inadecuado.` : '',
        cautionWh.length > 0 ? `Monitorear mensualmente los ${cautionWh.length} depósitos en precaución y planificar expansión preventiva cuando superen el 80% de ocupación.` : '',
        'Analizar la distribución de productos entre depósitos: redistribuir desde los más ocupados hacia los subutilizados para equilibrar la carga.',
        'Implementar un sistema de gestión de almacenes (WMS) que optimice el uso del espacio mediante la reorganización dinámica del layout.',
      ].filter(Boolean),
      tips: [
        'Como regla general, mantener la ocupación entre el 60% y 80% permite absorber picos de demanda sin comprometer la operación ni desperdiciar capacidad.',
        'Revisar trimestralmente los productos de baja rotación: podrían ocupar espacio valioso en depósitos con alta ocupación.',
      ],
    };
  }, [warehouses]);

  return (
    <ChartCard title="Capacidad Promedio de Depósitos" delay={0.55} report={report}>
      <div className="flex flex-col items-center h-[260px]">
        <svg viewBox="0 0 200 120" className="w-full max-w-[220px] mt-2">
          <path d={`M ${polar(180).x} ${polar(180).y} A ${r} ${r} 0 1 1 ${polar(360).x} ${polar(360).y}`}
            fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
          {avgPct > 0 && (
            <path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
              fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>{avgPct.toFixed(0)}%</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6b7280">ocupación media</text>
        </svg>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 w-full mt-2">
          {warehouses.slice(0, 6).map((wh, i) => {
            const c = wh.pct < 60 ? "text-green-600" : wh.pct < 85 ? "text-yellow-600" : "text-red-600";
            const label = wh.workspaceName ? `${wh.workspaceName} - ${wh.name}` : wh.name;
            return (
              <div key={`${wh.name}-${i}`} className="flex items-center gap-1.5 min-w-0">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${c}`} />
                <p className="text-[10px] text-muted-foreground truncate flex-1">{label}</p>
                <p className={`text-[10px] font-bold ${c} shrink-0`}>{wh.pct.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}

// ── 11. BarChart horizontal: Ranking 100 Productos Estrella (top consumo) ──

export function ProductosEstrellaChart({ crossStock, consumptionData }: { crossStock: CrossHospitalMedStock[]; consumptionData: ConsumptionDataPoint[] }) {
  const consumedMap = new Map<string, number>();
  for (const d of consumptionData) {
    consumedMap.set(d.medicationName, (consumedMap.get(d.medicationName) ?? 0) + d.totalConsumed);
  }

  const data = [...consumedMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(consumptionData.map((d) => d.workspaceName))];
    const grandTotal = data.reduce((s, d) => s + d.total, 0);
    const top1 = data[0];

    const analysis = `El ranking de los 10 productos estrella muestra los medicamentos de mayor consumo en los últimos 30 días. ${top1?.name ?? 'El primer producto'} lidera con ${top1?.total.toLocaleString('es-AR') ?? 0} unidades consumidas, representando ${grandTotal > 0 ? ((top1?.total ?? 0) / grandTotal * 100).toFixed(1) : 0}% del total de ${grandTotal.toLocaleString('es-AR')} unidades consumidas en el top 10. Estos productos de alta rotación requieren una atención prioritaria en la gestión de inventario para evitar desabastecimientos.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        'Garantizar stock de seguridad para los 20 productos principales del ranking.',
        'Negociar contratos marco con proveedores para estos productos de alta demanda.',
        'Monitorear semanalmente el nivel de stock de los productos estrella para evitar roturas.',
      ],
      tips: ['Los productos de mayor consumo suelen concentrar el 80% del valor del inventario (principio de Pareto).'],
    };
  }, [data]);

  return (
    <ChartCard title="Top 10 Productos Estrella" delay={0.4} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={180} interval={0} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS_HEX[i % COLORS_HEX.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 12. BarChart horizontal: Ranking 100 Productos Estancados (menor consumo) ──

export function ProductosEstancadosChart({ crossStock, consumptionData }: { crossStock: CrossHospitalMedStock[]; consumptionData: ConsumptionDataPoint[] }) {
  const consumedMap = new Map<string, number>();
  for (const d of consumptionData) {
    consumedMap.set(d.medicationName, (consumedMap.get(d.medicationName) ?? 0) + d.totalConsumed);
  }

  const zeroConsumption: { name: string; total: number }[] = [];
  for (const m of crossStock) {
    if (!consumedMap.has(m.medicationName)) {
      const totalStock = m.stocks.reduce((s, ws) => s + ws.quantity, 0);
      if (totalStock > 0) {
        zeroConsumption.push({ name: m.medicationName, total: 0 });
      }
    }
  }

  const withConsumption = [...consumedMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => a.total - b.total);

  const data = [...zeroConsumption, ...withConsumption].slice(0, 10);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(consumptionData.map((d) => d.workspaceName))];
    const stagnantCount = data.filter((d) => d.total === 0).length;

    const analysis = `El ranking de los 10 productos estancados revela ${stagnantCount} medicamentos con consumo cero en los últimos 30 días, a pesar de tener stock disponible. El resto del ranking corresponde a medicamentos con muy baja rotación. Estos productos representan capital inmovilizado y riesgo de vencimiento, por lo que requieren una estrategia de liquidación, redistribución o devolución a proveedores.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        'Identificar los medicamentos con consumo cero y evaluar su necesidad clínica real.',
        'Priorizar la redistribución de productos estancados hacia hospitales con posible demanda.',
        'Establecer una política de devolución a proveedores para productos sin rotación en más de 90 días.',
      ],
      tips: ['Un producto estancado genera costos de almacenamiento sin beneficio terapéutico. Revisar la vigencia y fechas de vencimiento.'],
    };
  }, [data]);

  return (
    <ChartCard title="Top 10 Productos Estancados" delay={0.45} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={180} interval={0} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS_HEX[(i + 3) % COLORS_HEX.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

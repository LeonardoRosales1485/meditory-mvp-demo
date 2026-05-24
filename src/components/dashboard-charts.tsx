import { motion } from "framer-motion";
import { useRef, useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ComposedChart, Line, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarRadiusAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { captureChartAsDataUrl, downloadChartAsPng, downloadElementAsPng } from "@/lib/utils";
import { generateChartReportPdf } from "@/lib/pdf-generator";
import type { CrossHospitalMedStock } from "@/lib/server/backoffice-service";

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
    const row: Record<string, string | number> = { name: med.medicationName.slice(0, 10) };
    for (const s of med.stocks) {
      row[s.workspaceName.split(" ")[1] ?? s.workspaceName] = s.quantity;
    }
    return row;
  });

  const wsNames = workspaces.map((ws) => ws.name.split(" ")[1] ?? ws.name);

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
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive
            label={({ name, percent }) => `${name.split(" ")[1]}: ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
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
    </ChartCard>
  );
}

// ── 3. RadarChart: Comparativa multi-eje de hospitales ───────

export function HospitalRadarChart({ workspaces }: { workspaces: WorkspaceStat[] }) {
  const wsFullNames = workspaces.map((ws) => ws.name);
  const wsShortNames = workspaces.map((ws) => ws.name.split(" ")[1] ?? ws.name);
  const maxUnits = Math.max(...workspaces.map((w) => w.totalUnits), 1);
  const data = [
    { axis: "Stock", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, Math.round((ws.totalUnits / maxUnits) * 100)])) },
    { axis: "Usuarios", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.totalUsers * 10])) },
    { axis: "Depósitos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.totalWarehouses * 30])) },
    { axis: "Movimientos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.movementsToday * 20])) },
    { axis: "Medicamentos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, 80])) },
  ];

  const report: ChartReport = useMemo(() => {
    const wsFullNames = workspaces.map((ws) => ws.name);
    const bestStock = workspaces.reduce((a, b) => a.totalUnits > b.totalUnits ? a : b);
    const worstStock = workspaces.reduce((a, b) => a.totalUnits < b.totalUnits ? a : b);
    const bestMovements = workspaces.reduce((a, b) => a.movementsToday > b.movementsToday ? a : b);
    const wsLines: string[] = workspaces.map((ws) => `${ws.name} (${ws.totalUnits} uds, ${ws.totalWarehouses} depósitos, ${ws.movementsToday} movs/día)`);

    const analysis = `La comparativa multi-indicador entre hospitales revela perfiles operativos notablemente distintos. ${bestStock.name} lidera en volumen de stock total con ${bestStock.totalUnits.toLocaleString('es-AR')} unidades, mientras que ${worstStock.name} registra el menor inventario (${worstStock.totalUnits.toLocaleString('es-AR')} unidades). En cuanto a actividad, ${bestMovements.name} presenta la mayor cantidad de movimientos diarios (${bestMovements.movementsToday}), lo que sugiere una rotación de inventario más dinámica. El análisis por hospital muestra que: ${wsLines.join('; ')}. Esta heterogeneidad sugiere que cada hospital opera con niveles de recursos y demandas distintas, lo que refuerza la necesidad de estrategias de gestión diferenciadas pero coordinadas.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        `Establecer un plan de equiparación progresiva para que ${worstStock.name} alcance al menos el 70% del stock de ${bestStock.name} en medicamentos críticos.`,
        'Implementar indicadores comunes de eficiencia (rotación de stock, días de cobertura) para evaluar el desempeño relativo de cada hospital con los mismos criterios.',
        `Utilizar la mayor actividad de ${bestMovements.name} como caso de estudio para identificar prácticas replicables en los demás hospitales.`,
      ],
      tips: ['Realizar este análisis comparativo mensualmente para detectar tendencias y corregir desviaciones a tiempo.'],
    };
  }, [workspaces]);

  return (
    <ChartCard title="Comparativa Multi-Indicador" delay={0.1} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
          {wsShortNames.map((ws, i) => (
            <Radar key={ws} name={ws} dataKey={ws} stroke={COLORS_HEX[i]} fill={COLORS_HEX[i]} fillOpacity={0.25} isAnimationActive />
          ))}
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 4. AreaChart: Consumo histórico 30d ─────────────────────

export interface ConsumptionPoint { date: string; workspaceName: string; totalConsumed: number }

export function ConsumptionAreaChart({ data }: { data: ConsumptionPoint[] }) {
  const wsFullNames = [...new Set(data.map((d) => d.workspaceName))];
  const wsNames = wsFullNames.map((n) => n.split(" ")[1] ?? n);
  const byDate = new Map<string, Record<string, number>>();

  for (const d of data) {
    const ws = d.workspaceName.split(" ")[1] ?? d.workspaceName;
    if (!byDate.has(d.date)) byDate.set(d.date, {});
    const row = byDate.get(d.date)!;
    row[ws] = (row[ws] ?? 0) + d.totalConsumed;
  }

  const chartData = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-20)
    .map(([date, vals]) => ({ date: date.slice(5), ...vals }));

  const totalConsumed = data.reduce((s, d) => s + d.totalConsumed, 0);

  const report: ChartReport = useMemo(() => {
    const wsFullNames = [...new Set(data.map((d) => d.workspaceName))];
    const totalConsumed = data.reduce((s, d) => s + d.totalConsumed, 0);
    const byWs = new Map<string, number>();
    for (const d of data) {
      byWs.set(d.workspaceName, (byWs.get(d.workspaceName) ?? 0) + d.totalConsumed);
    }
    const topWs = [...byWs.entries()].sort((a, b) => b[1] - a[1]);
    const avgDaily = Math.round(totalConsumed / 30);
    const dates = [...new Set(data.map((d) => d.date))].sort();
    const firstDate = dates[0] ?? '';
    const lastDate = dates[dates.length - 1] ?? '';

    const analysis = `Durante el período del ${firstDate} al ${lastDate} se registró un consumo total de ${totalConsumed.toLocaleString('es-AR')} unidades de medicamentos en todos los hospitales, con un promedio diario de ${avgDaily.toLocaleString('es-AR')} unidades. ${topWs[0]?.[0] ?? 'Un hospital'} lidera el consumo con ${topWs[0]?.[1]?.toLocaleString('es-AR') ?? 0} unidades (${totalConsumed > 0 ? ((topWs[0]?.[1] ?? 0) / totalConsumed * 100).toFixed(1) : 0}% del total), seguido por ${topWs[1]?.[0] ?? 'otro'} con ${topWs[1]?.[1]?.toLocaleString('es-AR') ?? 0} unidades. La variabilidad en el consumo diario sugiere picos de demanda que podrían estar asociados a campañas de salud, estacionalidad o programas de tratamiento específicos. Identificar estos patrones es clave para optimizar la planificación de compras y evitar tanto el desabastecimiento como el exceso de inventario.`;

    const tips: string[] = [];
    if (avgDaily > 100) {
      tips.push('Si el consumo promedio supera las 100 unidades diarias, considerar la implementación de un stock de seguridad calculado en función de la desviación estándar del consumo histórico.');
    }

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        'Cruzar los picos de consumo con las campañas sanitarias y programas de salud para ajustar las compras preventivas.',
        'Calcular el stock de seguridad óptimo usando la fórmula: (consumo máximo diario × plazo de reposición) - (consumo promedio × plazo de reposición).',
        `Establecer reuniones semanales de revisión de consumo entre los hospitales para anticipar desabastecimientos, especialmente en ${topWs[0]?.[0] ?? 'el hospital de mayor consumo'}.`,
      ],
      tips,
    };
  }, [data]);

  return (
    <ChartCard title="Consumo Histórico 30 días" delay={0.15} report={report}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ left: -15 }}>
          <defs>
            {wsNames.map((ws, i) => (
              <linearGradient key={ws} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS_HEX[i]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={COLORS_HEX[i]} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {wsNames.map((ws, i) => (
            <Area key={ws} type="monotone" dataKey={ws} stroke={COLORS_HEX[i]} fill={`url(#grad${i})`} strokeWidth={2} isAnimationActive />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 5. BarChart horizontal: Top 10 medicamentos más stockeados

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
          <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS_HEX[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 6. ComposedChart: Stock actual vs demanda óptima ─────────

export function StockVsDemandChart({ crossStock }: { crossStock: CrossHospitalMedStock[] }) {
  const data = crossStock.slice(0, 10).map((m) => ({
    name: m.medicationName.slice(0, 8),
    fullName: m.medicationName,
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

    const analysis = `Del total de ${data.length} medicamentos analizados, solo el ${pctOnTarget}% se encuentra dentro del rango óptimo de stock. Se identificaron ${deficitMeds.length} medicamentos con déficit (faltante total de ${totalDeficit.toLocaleString('es-AR')} unidades para alcanzar el nivel óptimo) y ${surplusMeds.length} con superávit (excedente de ${totalSurplus.toLocaleString('es-AR')} unidades). De estos, ${criticalMeds.length} medicamentos se encuentran por debajo del stock mínimo, lo que representa un riesgo inminente de desabastecimiento. Los medicamentos más críticos son: ${criticalMeds.slice(0, 3).map((m) => `${m.fullName} (actual: ${m.stockTotal}, óptimo: ${m.optimalTotal})`).join('; ')}. Esta brecha entre el stock actual y los niveles óptimos sugiere que los parámetros de inventario no se actualizan con la frecuencia necesaria o que las compras no se ajustan a la demanda real.`;

    return {
      workspaceNames: wsFullNames,
      analysis,
      recommendations: [
        criticalMeds.length > 0 ? `Activar compra de emergencia para: ${criticalMeds.map((m) => m.fullName).join(', ')}.` : '',
        deficitMeds.length > 0 && surplusMeds.length > 0 ? `Transferir excedentes de ${surplusMeds[0]?.fullName ?? ''} y ${surplusMeds[1]?.fullName ?? ''} hacia los hospitales con déficit, reduciendo la necesidad de compra externa.` : '',
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
        <ComposedChart data={data} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString("es-AR")} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="stockTotal" name="Stock actual" isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS_HEX[i]} />)}
          </Bar>
          <Line type="monotone" dataKey="optimalTotal" name="Óptimo" stroke="#1e293b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="minTotal" name="Mínimo" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
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
    <ChartCard title="Distribución por Medicamento (Treemap)" delay={0.3} report={report}>
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
    return "bg-blue-200 dark:bg-blue-900";
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
    const wsNamesList = workspaceNames.map((n) => n.split(" ")[1] ?? n).join(', ');

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
                <th key={ws} className="px-1 text-center font-medium text-muted-foreground">{ws.split(" ")[1] ?? ws}</th>
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
          {[["bg-red-300","Sin stock"], ["bg-orange-200","Crítico"], ["bg-green-200","Óptimo"], ["bg-blue-200","Superávit"]].map(([cls, label]) => (
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

// ── 10. Sankey simplificado SVG: Flujo de pérdidas ───────────

export function LossSankeyChart({ totalStock, lossAmount, savingAmount }: { totalStock: number; lossAmount: number; savingAmount: number }) {
  const usedPct = Math.max(5, Math.min(80, ((totalStock - lossAmount / 100) / totalStock) * 100));
  const lossPct = Math.max(5, 100 - usedPct - 10);

  const report: ChartReport = useMemo(() => {
    const usedPct = Math.max(5, Math.min(80, ((totalStock - lossAmount / 100) / totalStock) * 100));
    const lossPct = Math.max(5, 100 - usedPct - 10);
    const savingVsLoss = lossAmount > 0 ? ((savingAmount / lossAmount) * 100).toFixed(0) : "0";

    const analysis = `Del total de ${(totalStock / 1000).toFixed(1)}K unidades en stock, se estima que el ${lossPct.toFixed(0)}% corresponde a stock ocioso que podría generar una pérdida económica de $${(lossAmount / 1000).toFixed(0)}K por vencimientos, costos de almacenamiento y capital inmovilizado. Sin embargo, mediante la implementación de transferencias internas entre hospitales, sería posible recuperar $${savingAmount.toLocaleString('es-AR')}, lo que representa el ${savingVsLoss}% de la pérdida potencial. Esto significa que una parte significativa del stock ocioso en un hospital podría ser aprovechado por otro hospital con déficit, transformando una pérdida en un ahorro. El impacto financiero de no implementar transferencias internas es sustancial y afecta directamente al presupuesto operativo de la red hospitalaria.`;

    return {
      workspaceNames: [],
      analysis,
      recommendations: [
        'Implementar un programa de transferencias internas con proceso estandarizado: detección de superávit → notificación → solicitud → aprobación → envío → confirmación de recepción.',
        'Designar un coordinador logístico de la red hospitalaria responsable de identificar semanalmente oportunidades de transferencia entre hospitales.',
        'Establecer un plazo máximo de 48 horas para completar las transferencias internas una vez identificada la oportunidad.',
        `Capacitar al personal de farmacia en la identificación de stock ocioso y en el uso de la plataforma de gestión de transferencias.`,
      ],
      tips: [
        'Cada mes sin transferencias internas representa una pérdida evitable. Automatizar la detección de oportunidades de transferencia puede reducir el stock ocioso hasta en un 40%.',
        'Considerar la creación de un fondo de compensación interna para incentivar a los hospitales que transfieren medicamentos, cubriendo sus costos logísticos.',
      ],
    };
  }, [totalStock, lossAmount, savingAmount]);

  return (
    <ChartCard title="Flujo de Pérdidas — Stock Ocioso" delay={0.5} report={report}>
      <div className="flex flex-col items-center justify-center h-[260px] gap-3 px-4">
        <div className="w-full flex items-center gap-2 text-sm">
          <div className="bg-blue-500 text-white px-3 py-2 rounded text-xs text-center min-w-[90px]">
            Stock Total<br /><strong>{(totalStock / 1000).toFixed(1)}K uds</strong>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-0.5 flex-1 bg-green-400" />
              <div className="bg-green-100 dark:bg-green-900 border border-green-300 px-2 py-1 rounded text-xs text-green-700 dark:text-green-300">
                Uso eficiente ({(100 - lossPct).toFixed(0)}%)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 flex-1 bg-red-400" />
              <div className="bg-red-100 dark:bg-red-900 border border-red-300 px-2 py-1 rounded text-xs text-red-700 dark:text-red-300">
                Stock ocioso ({lossPct.toFixed(0)}%)
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs text-center">
              Hospitalización
            </div>
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs text-center">
              Vencimiento<br /><strong>${(lossAmount / 1000).toFixed(0)}K pérdida</strong>
            </div>
          </div>
        </div>
        <div className="w-full bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Con transferencias internas se recuperaría</p>
          <p className="text-lg font-bold text-green-600">${savingAmount.toLocaleString("es-AR")}</p>
        </div>
      </div>
    </ChartCard>
  );
}

// ── 12. Semi-circle donut: Capacidad depósitos ───────────────

export interface WarehouseVolumeSummary { name: string; pct: number }

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
  const largeArc = (avgPct / 100) * 180 > 90 ? 1 : 0;

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
        <div className="grid grid-cols-3 gap-1 w-full mt-2">
          {warehouses.slice(0, 6).map((wh, i) => {
            const c = wh.pct < 60 ? "text-green-600" : wh.pct < 85 ? "text-yellow-600" : "text-red-600";
            return (
              <div key={`${wh.name}-${i}`} className="text-center">
                <p className={`text-xs font-bold ${c}`}>{wh.pct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground truncate">{wh.name}</p>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}

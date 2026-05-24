import { motion } from "framer-motion";
import { useRef } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ComposedChart, Line, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarRadiusAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadChartAsPng, downloadElementAsPng } from "@/lib/utils";
import type { CrossHospitalMedStock } from "@/lib/server/backoffice-service";

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

function ChartCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    if (!cardRef.current) return;
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

  return (
    <ChartCard title="Stock por Hospital × Medicamento" delay={0}>
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

  return (
    <ChartCard title="Distribución de Stock por Hospital" delay={0.05}>
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
  const maxUnits = Math.max(...workspaces.map((w) => w.totalUnits), 1);
  const data = [
    { axis: "Stock", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, Math.round((ws.totalUnits / maxUnits) * 100)])) },
    { axis: "Usuarios", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.totalUsers * 10])) },
    { axis: "Depósitos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.totalWarehouses * 30])) },
    { axis: "Movimientos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, ws.movementsToday * 20])) },
    { axis: "Medicamentos", ...Object.fromEntries(workspaces.map((ws) => [ws.name.split(" ")[1] ?? ws.name, 80])) },
  ];

  const wsShortNames = workspaces.map((ws) => ws.name.split(" ")[1] ?? ws.name);

  return (
    <ChartCard title="Comparativa Multi-Indicador" delay={0.1}>
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
  const byDate = new Map<string, Record<string, number>>();
  const wsNames = [...new Set(data.map((d) => d.workspaceName.split(" ")[1] ?? d.workspaceName))];

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

  return (
    <ChartCard title="Consumo Histórico 30 días" delay={0.15}>
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

  return (
    <ChartCard title="Top 10 Medicamentos más Stockeados" delay={0.2}>
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
    stockTotal: m.stocks.reduce((s, ws) => s + ws.quantity, 0),
    optimalTotal: m.stocks.reduce((s, ws) => s + ws.optimalStock, 0),
    minTotal: m.stocks.reduce((s, ws) => s + ws.minStock, 0),
  }));

  return (
    <ChartCard title="Stock Actual vs Demanda Óptima" delay={0.25}>
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

  return (
    <ChartCard title="Distribución por Medicamento (Treemap)" delay={0.3}>
      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          aspectRatio={4 / 3}
          isAnimationActive
          // @ts-expect-error — Recharts Treemap accepts a render function but types require ReactElement
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

  return (
    <ChartCard title="Heatmap Stock — Medicamento × Hospital" delay={0.35}>
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

  return (
    <ChartCard title="Flujo de Pérdidas — Stock Ocioso" delay={0.5}>
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

  return (
    <ChartCard title="Capacidad Promedio de Depósitos" delay={0.55}>
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

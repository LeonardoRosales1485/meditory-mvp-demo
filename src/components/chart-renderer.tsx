import { useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadChartAsPng } from "@/lib/utils";
import type { ChartSpec } from "@/lib/assistant-tools";

const COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
];

export function ChartRenderer({ spec, height = 260 }: { spec: ChartSpec; height?: number }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { chartType, title, data } = spec;

  async function handleDownload() {
    if (!chartRef.current) return;
    try {
      await downloadChartAsPng(chartRef.current, `chart-${title ?? "grafico"}`);
    } catch {
      try {
        const mod = await import("html2canvas");
        if (!mod?.default) { toast.error("Error al cargar el generador de imagen"); return; }
        const scale = Math.min(window.devicePixelRatio || 1, 1.5);
        const canvas = await mod.default(chartRef.current, { scale, useCORS: true, allowTaint: false });
        const link = document.createElement("a");
        link.download = `chart-${(title ?? "grafico").replace(/\s+/g, "-").toLowerCase()}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        toast.error("No se pudo descargar el gráfico", { description: "Ocurrió un error al generar la imagen." });
      }
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="my-2 w-full rounded-lg border bg-card p-3 text-center text-sm text-muted-foreground">
        No hay datos para mostrar el gráfico.
      </div>
    );
  }

  return (
    <div ref={chartRef} className="group relative my-2 w-full rounded-lg border bg-card p-3">
      {title && (
        <p className="mb-2 text-center text-sm font-medium">{title}</p>
      )}
      <button
        onClick={handleDownload}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
        title="Descargar gráfico"
      >
        <Download size={14} />
      </button>
      <ResponsiveContainer width="100%" height={height}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill ?? COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.2}
            />
          </AreaChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1" }}
            />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill ?? COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Treemap,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/demo-charts")({
  component: DemoChartsPage,
});

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const composedData = MONTHS.map((m, i) => ({
  name: m,
  ingresos: Math.round(8000 + Math.sin(i * 0.8) * 3000 + Math.random() * 2000),
  egresos: Math.round(7000 + Math.cos(i * 0.6) * 2500 + Math.random() * 1800),
  perdidas: Math.round(200 + Math.abs(Math.sin(i * 1.2)) * 300 + Math.random() * 100),
  proyeccion: Math.round(7500 + Math.sin(i * 0.7 + 0.5) * 2800),
}));

const radarData = [
  { metric: "Rotación", "Hospital Blanco": 85, "Hospital Alemán": 92, "Clínica del Sur": 68 },
  { metric: "Precisión", "Hospital Blanco": 78, "Hospital Alemán": 95, "Clínica del Sur": 72 },
  { metric: "Cobertura", "Hospital Blanco": 92, "Hospital Alemán": 88, "Clínica del Sur": 80 },
  { metric: "Eficiencia", "Hospital Blanco": 70, "Hospital Alemán": 96, "Clínica del Sur": 74 },
  { metric: "Disponibilidad", "Hospital Blanco": 88, "Hospital Alemán": 91, "Clínica del Sur": 65 },
];

const treemapData = {
  name: "Stock",
  children: [
    { name: "Analgésicos", size: 4850 },
    { name: "Antibióticos", size: 7200 },
    { name: "Cardiovasculares", size: 3800 },
    { name: "Neurológicos", size: 2900 },
    { name: "Respiratorios", size: 2100 },
    { name: "Digestivos", size: 1650 },
    { name: "Dermatológicos", size: 1200 },
    { name: "Vacunas", size: 5400 },
    { name: "Oncológicos", size: 980 },
    { name: "Oftálmicos", size: 850 },
  ],
};

const TREEMAP_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#4f46e5", "#be123c", "#65a30d",
];

function CustomTreemapContent({ root, depth, x, y, width, height, index, name }: any) {
  if (depth > 1) return null;
  const color = TREEMAP_COLORS[index % TREEMAP_COLORS.length];
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={color} stroke="#fff" strokeWidth={2}
        rx={4} ry={4}
        style={{ cursor: "pointer" }}
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2} y={y + height / 2}
          textAnchor="middle" fill="#fff"
          fontSize={13} fontWeight={600}
          fontFamily="var(--font-sans)"
        >
          {name}
        </text>
      )}
    </g>
  );
}

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function DemoChartsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo: Gráficos Complejos"
        description="Ejemplos de visualizaciones avanzadas con Recharts — ComposedChart, Radar, Treemap."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ComposedChart — Stock vs Demanda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={composedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ingresos" fill={COLORS[0]} radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="egresos" fill={COLORS[1]} radius={[4, 4, 0, 0]} barSize={16} />
                <Line dataKey="proyeccion" stroke={COLORS[3]} strokeWidth={3} dot={{ r: 4, fill: COLORS[3] }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">RadarChart — Comparativa Multi-Hospital</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Radar name="Hospital Blanco" dataKey="Hospital Blanco" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.15} />
                <Radar name="Hospital Alemán" dataKey="Hospital Alemán" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.15} />
                <Radar name="Clínica del Sur" dataKey="Clínica del Sur" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.15} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Treemap — Stock por Categoría Terapéutica</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <Treemap
              data={treemapData.children}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={<CustomTreemapContent />}
            >
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value.toLocaleString()} u`, "Stock"]}
              />
            </Treemap>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

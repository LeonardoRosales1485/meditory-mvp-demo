import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, DollarSign, Trophy, Info, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CHAT_PRESET_EVENT } from "@/components/demo-assistant-chat";

const PRESET_LOSS = "Analizá el sobrestock del Hospital Alemán. Identificá los 3 medicamentos con mayor excedente sobre el nivel óptimo, calculá su valor en $ y cuánto se podría recuperar transfiriendo a Francisco o Blanco. No crees registros en la base de datos. Decime exactamente qué transfers harías, con qué cantidades, y qué tengo que hacer yo para ejecutarlas.";

const PRESET_SAVING = "Priorizá las transferencias del análisis anterior por impacto económico. Mostrame el top 5 y el ahorro acumulado. Indicame qué acciones tomar desde cada institución.";

const PRESET_CRITICAL = "Analizá qué medicamentos están por debajo del mínimo en cada hospital. Sugerí cuáles cubrir con transfers desde Alemán y cuáles requieren orden de compra urgente.";

function dispatchPreset(text: string) {
  window.dispatchEvent(new CustomEvent(CHAT_PRESET_EVENT, { detail: text }));
}

interface KpiCardProps {
  value: number;
  label: string;
  sublabel?: string;
  tooltip?: string;
  color?: "red" | "green" | "yellow" | "blue" | "default";
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  delay?: number;
  action?: React.ReactNode;
}

function useCountUp(target: number, duration = 1500) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return current;
}

const colorMap = {
  red: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-600 dark:text-red-400", icon: "bg-red-100 dark:bg-red-900/50" },
  green: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", text: "text-green-600 dark:text-green-400", icon: "bg-green-100 dark:bg-green-900/50" },
  yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-600 dark:text-yellow-400", icon: "bg-yellow-100 dark:bg-yellow-900/50" },
  blue: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-600 dark:text-blue-400", icon: "bg-blue-100 dark:bg-blue-900/50" },
  default: { bg: "bg-card", border: "border-border", text: "text-foreground", icon: "bg-muted" },
};

export function KpiCard({ value, label, sublabel, tooltip, color = "default", prefix = "", suffix = "", icon, highlight = false, delay = 0, action }: KpiCardProps) {
  const count = useCountUp(value, 1400);
  const c = colorMap[color];

  const formatted = prefix === "$"
    ? `$${count.toLocaleString("es-AR")}`
    : `${prefix}${count.toLocaleString("es-AR")}${suffix}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ scale: 1.02 }}
      className={highlight ? "hospital-aleman-highlight rounded-xl" : ""}
    >
      <Card className={`border ${c.border} ${c.bg} h-full min-h-[170px]`}>
        <CardContent className="p-5 flex flex-col gap-4 h-full">
          <div className="flex items-start gap-4">
            {icon && (
              <div className={`${c.icon} p-2.5 rounded-lg shrink-0`}>
                <div className={c.text}>{icon}</div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <p className="text-sm text-muted-foreground leading-snug flex-1">{label}</p>
                {tooltip && (
                  <div className="group relative shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help transition-colors" />
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 hidden group-hover:block w-56 rounded-lg border bg-popover text-popover-foreground text-xs p-2.5 shadow-xl leading-relaxed">
                      {tooltip}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-popover" />
                    </div>
                  </div>
                )}
              </div>
              <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{formatted}</p>
              {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
            </div>
          </div>
          {action && <div className="mt-auto flex justify-center">{action}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface KpiRowProps {
  totalUnits: number;
  lossWithoutTransfers: number;
  savingWithTransfers: number;
  criticalMeds: number;
  alemanUnits: number;
}

export function KpiRow({ totalUnits, lossWithoutTransfers, savingWithTransfers, criticalMeds, alemanUnits }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard
        value={totalUnits}
        label="Total Unidades (global)"
        sublabel="3 hospitales"
        tooltip="Suma de todas las unidades en stock en los 3 hospitales y sus depósitos (Central, Interna y Ventas). Incluye todos los medicamentos activos."
        color="blue"
        icon={<TrendingUp size={18} />}
        delay={0}
      />
      <KpiCard
        value={lossWithoutTransfers}
        label="Pérdida sin transfers"
        sublabel="Stock ocioso sin redistribuir"
        tooltip="Valor en $ del sobrestock que el Hospital Alemán tiene por encima de su nivel óptimo. Este stock 'duerme' mientras otros hospitales licitan esas mismas drogas sin saber que hay unidades disponibles cerca."
        color="red"
        prefix="$"
        icon={<DollarSign size={18} />}
        delay={0.1}
        action={
          <button onClick={() => dispatchPreset(PRESET_LOSS)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/30 active:scale-95">
            <Bot size={14} />
            Optimizar
          </button>
        }
      />
      <KpiCard
        value={savingWithTransfers}
        label="Ahorro potencial"
        sublabel="Con transferencias internas"
        tooltip="Lo que el sistema ahorraría en licitaciones si Alemán transfiriera su sobrestock a Francisco y Blanco antes de comprar. Es el dinero que se pierde por no coordinar entre hospitales."
        color="green"
        prefix="$"
        icon={<TrendingUp size={18} />}
        delay={0.2}
        action={
          <button onClick={() => dispatchPreset(PRESET_SAVING)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/30 active:scale-95">
            <Bot size={14} />
            Optimizar
          </button>
        }
      />
      <KpiCard
        value={criticalMeds}
        label="Medicamentos críticos"
        sublabel="Por debajo del mínimo"
        tooltip="Cantidad de medicamentos con stock actual por debajo del mínimo configurado en al menos uno de los 3 hospitales. Requieren atención inmediata o licitación urgente."
        color="yellow"
        icon={<AlertTriangle size={18} />}
        delay={0.3}
        action={
          <button onClick={() => dispatchPreset(PRESET_CRITICAL)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/30 active:scale-95">
            <Bot size={14} />
            Optimizar
          </button>
        }
      />
      <KpiCard
        value={alemanUnits}
        label="Hospital Alemán"
        sublabel="#1 en stock del sistema"
        tooltip="Unidades totales en los 3 depósitos del Hospital Alemán. Concentra la mayor parte del stock del sistema y es la fuente principal de sobrestock transferible."
        color="green"
        icon={<Trophy size={18} />}
        highlight
        delay={0.4}
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Brain, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/backoffice/config-asistente")({
  component: BackofficeConfigAsistentePage,
});

const PROVIDERS = [
  {
    id: "anthropic" as const,
    label: "Anthropic",
    model: "claude-sonnet-4-6",
    envKey: "ANTHROPIC_API_KEY",
    description: "Claude Sonnet 4.6 — alta calidad, soporte nativo de herramientas, prompt caching.",
  },
  {
    id: "zen" as const,
    label: "OpenCode Zen",
    model: "deepseek-v4-flash-free",
    envKey: "ZEN_API_KEY",
    description: "DeepSeek vía OpenCode — alternativa gratuita con capacidad de herramientas.",
  },
] as const;

function BackofficeConfigAsistentePage() {
  const aiProvider = useStore((s) => s.aiProvider);
  const setAiProvider = useStore((s) => s.setAiProvider);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Configuración del Asistente</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Proveedor de IA
          </CardTitle>
          <CardDescription>
            Seleccioná el proveedor que usará el asistente "Medi" en todos los workspaces de este navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PROVIDERS.map((p) => {
            const active = aiProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiProvider(p.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {p.model}
                    </Badge>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Requiere <code className="rounded bg-muted px-0.5">{p.envKey}</code> en las variables de entorno.
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

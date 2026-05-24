import { createFileRoute } from "@tanstack/react-router";
import { Brain, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/backoffice/config-asistente")({
  component: BackofficeConfigAsistentePage,
});

function BackofficeConfigAsistentePage() {
  const aiProvider = useStore((s) => s.aiProvider);
  const setAiProvider = useStore((s) => s.setAiProvider);

  const providerInfo = aiProvider === "groq"
    ? { model: "llama-3.3-70b-versatile", icon: Globe, desc: "Groq (principal)" }
    : { model: "big-pickle / minimax-m2.5-free", icon: Brain, desc: "OpenCode Zen (fallback gratuito)" };

  const Icon = providerInfo.icon;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Configuración del Asistente</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            Proveedor de IA
          </CardTitle>
          <CardDescription>
            Elegí qué proveedor usa el asistente virtual del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as "groq" | "zen")}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="groq">Groq (principal)</SelectItem>
              <SelectItem value="zen">OpenCode Zen (fallback gratuito)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Badge variant={aiProvider === "groq" ? "default" : "secondary"}>
              {aiProvider === "groq" ? "Groq" : "OpenCode Zen"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Modelo: {providerInfo.model}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Los cambios se aplican inmediatamente al próximo mensaje.
            {aiProvider === "zen" && (
              " Necesitás tener configurada ZEN_API_KEY en las variables de entorno."
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

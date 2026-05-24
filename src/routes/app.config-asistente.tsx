import { createFileRoute } from "@tanstack/react-router";
import { Brain, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useStore } from "@/lib/store";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/app/config-asistente")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Meditory — Config. Asistente" }] }),
  component: ConfigAsistentePage,
});

function ConfigAsistentePage() {
  const aiProvider = useStore((s) => s.aiProvider);
  const setAiProvider = useStore((s) => s.setAiProvider);

  const providerInfo = aiProvider === "groq"
    ? { model: "llama-3.3-70b-versatile", icon: Globe, desc: "Groq (principal)" }
    : { model: "deepseek-v4-flash-free", icon: Brain, desc: "OpenCode Zen (fallback gratuito)" };

  const Icon = providerInfo.icon;

  return (
    <div>
      <PageHeader
        title="Configuración del Asistente"
        description="Elegí el proveedor de IA para el asistente virtual."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            Proveedor de IA
          </CardTitle>
          <CardDescription>
            El asistente virtual (Medi) usará este proveedor para responder consultas.
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
            Los cambios se aplican inmediatamente al próximo mensaje del asistente.
            {aiProvider === "zen" && (
              " Necesitás tener configurada la variable ZEN_API_KEY en el servidor."
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

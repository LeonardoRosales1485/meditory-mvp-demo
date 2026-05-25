import { createFileRoute } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/app/config-asistente")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Meditory — Config. Asistente" }] }),
  component: ConfigAsistentePage,
});

function ConfigAsistentePage() {
  return (
    <div>
      <PageHeader
        title="Configuración del Asistente"
        description="El asistente virtual (Medi) usa OpenCode Zen para responder consultas."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Proveedor de IA
          </CardTitle>
          <CardDescription>
            OpenCode Zen es el proveedor actual del asistente virtual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">OpenCode Zen</Badge>
            <span className="text-xs text-muted-foreground">
              Modelo: deepseek-v4-flash-free
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Necesitás tener configurada la variable ZEN_API_KEY en el servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

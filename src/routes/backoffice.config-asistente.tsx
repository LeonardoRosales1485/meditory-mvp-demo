import { createFileRoute } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/backoffice/config-asistente")({
  component: BackofficeConfigAsistentePage,
});

function BackofficeConfigAsistentePage() {
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
            Necesitás tener configurada ZEN_API_KEY en las variables de entorno.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

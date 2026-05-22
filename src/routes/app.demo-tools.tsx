import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { requireAdmin } from "@/lib/route-guards";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/demo-tools")({
  beforeLoad: requireAdmin,
  component: DemoToolsPage,
});

function DemoToolsPage() {
  const session = useStore((s) => s.session);
  const resetWorkspaceDemo = useStore((s) => s.resetWorkspaceDemo);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleReset() {
    setRunning(true);
    try {
      await resetWorkspaceDemo();
      toast.success("Institución reseteada", {
        description: "Se limpiaron depósitos y datos operativos. Se conservaron los usuarios.",
      });
      setConfirmOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo resetear la Institución.";
      toast.error("No se pudo resetear", { description: message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Tools"
        description={`Herramientas de prueba para ${session?.workspaceName ?? "Institución actual"}.`}
      />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta acción deja la Institución en estado inicial de demo tipo Hospital Blanco:
            elimina depósitos y todos los datos operativos, pero mantiene usuarios.
          </p>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Resetear Institución
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reseteo de Institución</DialogTitle>
            <DialogDescription>
              Se eliminarán depósitos, stock, movimientos, ventas, transferencias, dispensaciones,
              pedidos, medicamentos y auditoría. Los usuarios se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={running}>
              {running ? "Reseteando..." : "Sí, resetear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

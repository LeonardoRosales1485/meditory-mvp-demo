import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw, Database, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/backoffice/demo-tools")({
  component: BackofficeDemoToolsPage,
});

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

function BackofficeDemoToolsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"reset" | "seed" | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    setLoading(true);
    try {
      const { backofficeListWorkspacesRpc } = await import("@/lib/server-rpc");
      const result = await backofficeListWorkspacesRpc();
      setWorkspaces(result as Workspace[]);
    } catch (e) {
      toast.error("Error al cargar instituciones", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!selectedId) return;
    setRunning("reset");
    try {
      const { backofficeResetWorkspaceRpc } = await import("@/lib/server-rpc");
      await backofficeResetWorkspaceRpc({ data: { workspaceId: selectedId } });
      const wsName = workspaces.find((w) => w.id === selectedId)?.name ?? selectedId;
      toast.success(`${wsName} reseteado`, {
        description: "Se limpiaron depósitos, stock, movimientos y datos operativos.",
      });
      setConfirmAction(null);
    } catch (e) {
      toast.error("No se pudo resetear", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(null);
    }
  }

  async function handleSeed() {
    if (!selectedId) return;
    setRunning("seed");
    try {
      const ws = workspaces.find((w) => w.id === selectedId);
      if (!ws) return;
      const { backofficeSeedWorkspaceRpc } = await import("@/lib/server-rpc");
      await backofficeSeedWorkspaceRpc({ data: { workspaceId: selectedId, workspaceName: ws.name } });
      toast.success(`${ws.name} seedeado`, {
        description: "Se crearon depósitos, medicamentos, stock, configuración y movimientos recientes.",
      });
      setConfirmAction(null);
    } catch (e) {
      toast.error("No se pudo seedear", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(null);
    }
  }

  const selectedName = workspaces.find((w) => w.id === selectedId)?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Demo tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Herramientas para resetear o poblar instituciones con datos de prueba.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Institución objetivo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando instituciones...</p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-[400px]">
                <SelectValue placeholder="Seleccionar institución..." />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Resetear institución
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elimina depósitos, stock, movimientos, ventas, transferencias, dispensaciones,
              pedidos, medicamentos, pacientes y auditoría. Los usuarios se conservan.
            </p>
            <Button
              variant="destructive"
              disabled={!selectedId || running !== null}
              onClick={() => setConfirmAction("reset")}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {running === "reset" ? "Reseteando..." : "Resetear"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
          Seedear datos dummy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea depósitos (Central, Interna, Ventas), medicamentos con precios, stock inicial
              aleatorio, configuración de stock mínimo/óptimo y movimientos recientes
              simulados (consumos, dispensaciones, ventas, pedidos, transferencias).
              No duplica si ya existen.
            </p>
            <Button
              variant="default"
              disabled={!selectedId || running !== null}
              onClick={() => setConfirmAction("seed")}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {running === "seed" ? "Seedeando..." : "Seedear datos"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "reset" ? "Confirmar reseteo" : "Confirmar seed de datos"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "reset"
                ? `Se eliminarán todos los datos operativos de ${selectedName}. Los usuarios se conservan.`
                : `Se insertarán datos dummy en ${selectedName} (depósitos, medicamentos, stock, movimientos y configuración).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={running !== null}>
              Cancelar
            </Button>
            <Button
              variant={confirmAction === "reset" ? "destructive" : "default"}
              onClick={confirmAction === "reset" ? handleReset : handleSeed}
              disabled={running !== null}
            >
              {running !== null ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

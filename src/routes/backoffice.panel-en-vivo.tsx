import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BackofficeRealtimePanel } from "@/components/backoffice-realtime-panel";

export const Route = createFileRoute("/backoffice/panel-en-vivo")({
  component: PanelEnVivoPage,
});

function PanelEnVivoPage() {
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { backofficeGetDashboardDataRpc } = await import("@/lib/server-rpc");
        const result = await backofficeGetDashboardDataRpc() as { workspaces: { id: string; name: string }[] };
        setWorkspaces(result.workspaces);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Cargando panel en vivo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return <BackofficeRealtimePanel workspaces={workspaces} />;
}

import { BackofficeRealtimePanel } from "@/components/backoffice-realtime-panel";
import { useStore } from "@/lib/store";

export function AppRealtimePanel() {
  const session = useStore((s) => s.session);

  if (!session) return null;

  return (
    <BackofficeRealtimePanel
      workspaces={[{ id: session.workspaceId, name: session.workspaceName }]}
    />
  );
}

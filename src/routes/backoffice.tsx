import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Users, Database, LogOut, ShieldCheck, Menu, X, Activity,
  MessageSquareMore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceAssistantChat } from "@/components/workspace-assistant-chat";
import { useBackofficeStore } from "@/lib/backoffice-store";
import { requireBackofficeAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/backoffice")({
  head: () => ({ meta: [{ title: "Meditory — Backoffice" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/backoffice/login") {
      requireBackofficeAuth();
    }
  },
  component: BackofficeLayout,
});

const NAV_ITEMS = [
  { to: "/backoffice", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/backoffice/panel-en-vivo", label: "Panel en vivo", icon: Activity },
  { to: "/backoffice/workspaces", label: "Instituciones", icon: Building2 },
  { to: "/backoffice/usuarios", label: "Usuarios", icon: Users },
  { to: "/backoffice/esquema", label: "Esquema DB", icon: Database },
];

function BackofficeLayout() {
  const session = useBackofficeStore((s) => s.session);
  const logout = useBackofficeStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    useBackofficeStore.getState().hydrate();
  }, []);

  function handleLogout() {
    logout();
    navigate({ to: "/backoffice/login" });
  }

  const isLoginRoute = pathname === "/backoffice/login";

  if (isLoginRoute) return <Outlet />;
  if (!session) return null;

  return (
    <div className="flex h-svh min-h-0 w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">Meditory</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Backoffice</span>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.end ? { exact: true } : undefined}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 truncate px-1 text-xs text-muted-foreground">{session.email}</div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">{session.name}</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Chat floating button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      >
        <MessageSquareMore className="h-5 w-5" />
      </button>

      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Asistente IA</DialogTitle>
          </DialogHeader>
          <WorkspaceAssistantChat
            snapshotInput={{
              batches: [],
              medications: [],
              warehouses: [],
              transfers: [],
              workspaceName: "Backoffice",
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

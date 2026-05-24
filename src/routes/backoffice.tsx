import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2, Users, Database, LogOut, ShieldCheck, Menu, X, Activity,
  ShoppingCart, Settings, ArrowUp, FlaskConical, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceAssistantChat } from "@/components/workspace-assistant-chat";
import { DemoAssistantChat } from "@/components/demo-assistant-chat";
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
  { to: "/backoffice/estado-hospital", label: "Estado general", icon: Activity },
  { to: "/backoffice/compras", label: "Compras / Licitación", icon: ShoppingCart },
  { to: "/backoffice/gestion-pedidos", label: "Pedidos medicos", icon: ClipboardList },
  { to: "/backoffice/panel-en-vivo", label: "Panel en vivo", icon: Activity },
  { to: "/backoffice/workspaces", label: "Instituciones", icon: Building2 },
  { to: "/backoffice/usuarios", label: "Usuarios", icon: Users },
  { to: "/backoffice/demo-tools", label: "Demo tools", icon: FlaskConical },
  { to: "/backoffice/config-asistente", label: "Config. Asistente", icon: Settings },
  { to: "/backoffice/esquema", label: "Esquema DB", icon: Database },
];

function BackofficeLayout() {
  const session = useBackofficeStore((s) => s.session);
  const logout = useBackofficeStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    useBackofficeStore.getState().hydrate();
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 400);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  function handleLogout() {
    logout();
    navigate({ to: "/backoffice/login" });
  }

  const isLoginRoute = pathname === "/backoffice/login";

  if (isLoginRoute) return <Outlet />;
  if (!mounted || !session) return null;

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
              activeOptions={undefined}
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
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-lg transition-all hover:border-primary/40 hover:text-primary hover:shadow-xl active:scale-90"
          aria-label="Volver al inicio"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* Asistente Medi — oculto en gestión de pedidos (usa panel lateral) */}
      {!pathname.includes("/gestion-pedidos") && <DemoAssistantChat />}
    </div>
  );
}

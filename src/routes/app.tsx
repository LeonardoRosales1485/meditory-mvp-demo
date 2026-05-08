import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, User } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { WarehouseProvider } from "@/lib/warehouse-context";
import { useWarehouse } from "@/lib/warehouse-context";
import { syncUserAndFetchWorkspaceAfterRehydrate, useStore } from "@/lib/store";
import { requireAuth } from "@/lib/route-guards";
import { ROLE_DISPLAY } from "@/lib/store";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Meditory — Workspace" },
      { name: "description", content: "Gestión de inventario farmacéutico." },
    ],
  }),
  beforeLoad: requireAuth,
  component: AppLayout,
});

function AppLayout() {
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => {
      syncUserAndFetchWorkspaceAfterRehydrate();
    });
    if (useStore.persist.hasHydrated()) {
      syncUserAndFetchWorkspaceAfterRehydrate();
    }
    return unsub;
  }, []);

  return (
    <WarehouseProvider>
      <AppShell />
    </WarehouseProvider>
  );
}

function AppShell() {
  const { warehouseIds } = useWarehouse();
  const session = useStore((s) => s.session);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  if (session && session.role !== "admin" && warehouseIds.length === 0) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-lg border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">Sin depósitos asignados</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No tienes depósitos asignados, contactate con tu administrador.
            </p>
            <Button className="mt-4" variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppHeader() {
  const user = useStore((s) => s.user);
  const session = useStore((s) => s.session);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="hidden text-xs text-muted-foreground md:block">
        {session?.workspaceName}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-xs font-medium">{user.name}</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {session ? ROLE_DISPLAY[session.role] : user.role}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{session?.email ?? "Sesión demo"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  ArrowLeftRight,
  ShoppingCart,
  AlertTriangle,
  ScrollText,
  Pill,
  BookOpen,
  Sliders,
  ClipboardList,
  ListOrdered,
  UserRound,
  Users,
  Warehouse,
  Wrench,
  BedDouble,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useStore, type AppRole } from "@/lib/store";

type Item = { title: string; url: string; icon: typeof Package; exact?: boolean; roles: AppRole[] };

const ALL:              AppRole[] = ["admin", "ventas", "doctor", "tecnico"];
const ADMIN:            AppRole[] = ["admin"];
const ADMIN_VENTAS:     AppRole[] = ["admin", "ventas"];
const ADMIN_TECNICO:    AppRole[] = ["admin", "tecnico"];
const ADMIN_OR_DOCTOR:  AppRole[] = ["admin", "tecnico", "doctor"];
const ADMIN_DOCTOR:     AppRole[] = ["admin", "doctor"];
const NON_DOCTOR:       AppRole[] = ["admin", "ventas", "tecnico"];

const operations: Item[] = [
  { title: "Panel general",    url: "/app",               icon: LayoutDashboard, exact: true, roles: ALL },
  { title: "Inventario",       url: "/app/inventario",    icon: Package,                      roles: NON_DOCTOR },
  { title: "Catálogo",         url: "/app/catalogo",      icon: BookOpen,                     roles: ADMIN },
  { title: "Ingresos",         url: "/app/ingresos",      icon: PackagePlus,                  roles: ADMIN },
  { title: "Ajustes de stock", url: "/app/ajustes",       icon: Sliders,                      roles: ADMIN },
  { title: "Transferencias",   url: "/app/transferencias", icon: ArrowLeftRight,              roles: ADMIN_TECNICO },
  { title: "Depósitos",        url: "/app/depositos",      icon: Warehouse,                    roles: ADMIN },
];

const dispensingItems: Item[] = [
  { title: "Listas de precios", url: "/app/lista-precios", icon: ListOrdered, roles: ADMIN_VENTAS },
  { title: "Ventas", url: "/app/ventas", icon: ShoppingCart, roles: ADMIN_VENTAS },
  { title: "Pedidos médicos", url: "/app/pedidos", icon: ClipboardList, roles: ADMIN_OR_DOCTOR },
];

const internmentItems: Item[] = [
  { title: "Salas",               url: "/app/salas",       icon: BedDouble, roles: ADMIN_DOCTOR },
  { title: "Pacientes",           url: "/app/pacientes",   icon: UserRound, roles: ADMIN_DOCTOR },
];

const controlItems: Item[] = [
  { title: "Vencimientos", url: "/app/vencimientos", icon: AlertTriangle, roles: NON_DOCTOR },
  { title: "Auditoría",    url: "/app/auditoria",    icon: ScrollText,    roles: ADMIN },
  { title: "Usuarios",     url: "/app/usuarios",     icon: Users,         roles: ADMIN },
  { title: "Demo Tools",   url: "/app/demo-tools",   icon: Wrench,        roles: ADMIN },
];

export function AppSidebar() {
  const { state, isMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const session = useStore((s) => s.session);
  const warehouses = useStore((s) => s.warehouses);
  const role: AppRole = session?.role ?? "admin";
  const hasSalesWarehouse = warehouses.some(
    (w) => w.workspaceId === session?.workspaceId && w.type === "ventas" && !w.deletedAt,
  );

  const filter = (items: Item[]) =>
    items.filter((i) => {
      if (!i.roles.includes(role)) return false;
      if (i.url === "/app/ventas" && !hasSalesWarehouse) return false;
      return true;
    });
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");
  const handleNav = () => {
    if (isMobile) setOpen(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/app" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">Meditory</span>
              <span className="text-[11px] text-muted-foreground">
                {session?.workspaceName ?? "Demo"}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {filter(operations).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filter(operations).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                      <Link to={item.url} onClick={handleNav}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {filter(dispensingItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Dispensación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filter(dispensingItems).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} onClick={handleNav}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {filter(internmentItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Internación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filter(internmentItems).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} onClick={handleNav}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {filter(controlItems).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Control</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filter(controlItems).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} onClick={handleNav}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

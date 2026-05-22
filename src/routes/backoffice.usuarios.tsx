import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBackofficeStore } from "@/lib/backoffice-store";
import { useMobileListView } from "@/lib/use-mobile-list-view";

export const Route = createFileRoute("/backoffice/usuarios")({
  component: BackofficeUsuariosPage,
});

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "ventas", label: "Ventas" },
  { value: "doctor", label: "Doctor" },
  { value: "tecnico", label: "Enfermero Jefe" },
] as const;

interface Institucion {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
  workspace_id: string;
  type: string;
}

interface InstitucionUser {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string;
  workspaces: { name: string };
}

function BackofficeUsuariosPage() {
  const [users, setUsers] = useState<(InstitucionUser & { institucionName?: string })[]>([]);
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const { isMobile, viewMode, setViewMode } = useMobileListView("backoffice-usuarios");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InstitucionUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formInstitucionId, setFormInstitucionId] = useState("");
  const [formWarehouseIds, setFormWarehouseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [
        { backofficeListUsersRpc },
        { backofficeListWorkspacesRpc },
        { backofficeListWarehousesRpc },
      ] = await Promise.all([
        import("@/lib/server-rpc"),
        import("@/lib/server-rpc"),
        import("@/lib/server-rpc"),
      ]);
      const [u, w, wh] = await Promise.all([
        backofficeListUsersRpc(),
        backofficeListWorkspacesRpc(),
        backofficeListWarehousesRpc(),
      ]);
      const usersData = (u as (InstitucionUser & { workspaces: { name: string } })[]).map((u) => ({
        ...u,
        institucionName: u.workspaces?.name ?? "",
      }));
      setUsers(usersData);
      setInstituciones(w as Institucion[]);
      setWarehouses(wh as Warehouse[]);
    } catch (e) {
      toast.error("Error al cargar datos", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormRole("");
    setFormInstitucionId(instituciones[0]?.id ?? "");
    setFormWarehouseIds([]);
    setDialogOpen(true);
  }

  function openEdit(u: InstitucionUser) {
    setEditing(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormInstitucionId(u.workspace_id);
    setFormWarehouseIds([]);
    setDialogOpen(true);
  }

  const instWarehouses = warehouses.filter((w) => w.workspace_id === formInstitucionId);

  function toggleWh(whId: string) {
    setFormWarehouseIds((prev) =>
      prev.includes(whId) ? prev.filter((id) => id !== whId) : [...prev, whId],
    );
  }

  async function handleSave() {
    if (!formName.trim() || !formEmail.trim() || !formRole) {
      toast.error("Completá nombre, email y rol");
      return;
    }
    setSaving(true);
    try {
      const { backofficeCreateUserRpc, backofficeUpdateUserRpc } = await import("@/lib/server-rpc");
      if (editing) {
        await backofficeUpdateUserRpc({
          data: {
            id: editing.id,
            patch: {
              name: formName.trim(),
              email: formEmail.trim(),
              role: formRole,
              warehouseIds: formWarehouseIds,
            },
          },
        });
        toast.success("Usuario actualizado");
      } else {
        await backofficeCreateUserRpc({
          data: {
            workspaceId: formInstitucionId,
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            warehouseIds: formWarehouseIds,
          },
        });
        toast.success("Usuario creado");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error("Error al guardar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: InstitucionUser) {
    if (!confirm(`¿Eliminar a "${u.name}" (${u.email})?`)) return;
    try {
      const { backofficeDeleteUserRpc } = await import("@/lib/server-rpc");
      await backofficeDeleteUserRpc({ data: { id: u.id } });
      toast.success("Usuario eliminado");
      await load();
    } catch (e) {
      toast.error("Error al eliminar", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const roleBadge: Record<string, string> = {
    admin: "bg-primary-soft text-primary",
    ventas: "bg-amber-50 text-amber-700",
    doctor: "bg-violet-50 text-violet-700",
    tecnico: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo
        </Button>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : users.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay usuarios.</p>
          ) : (
            <>
              {isMobile && (
                <div className="px-4 pb-3 pt-1">
                  <MobileViewToggle value={viewMode} onChange={setViewMode} />
                </div>
              )}
              {isMobile && viewMode === "cards" ? (
                <div className="space-y-3 px-4 pb-4">
                  {users.map((u) => (
                    <Card key={u.id} className="shadow-sm">
                      <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{u.name}</p>
                            <p className="truncate">{u.email}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`capitalize ${roleBadge[u.role] ?? ""}`}>
                            {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                          </Badge>
                          <span>{u.institucionName}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Institución</TableHead>
                      <TableHead className="w-24">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${roleBadge[u.role] ?? ""}`}>
                            {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.institucionName}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Institución</Label>
                <Select value={formInstitucionId} onValueChange={setFormInstitucionId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {instituciones.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nombre Apellido" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@hospital.com"
                type="email"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {instWarehouses.length > 0 && (
              <div className="space-y-1.5">
                <Label>Acceso a depósitos</Label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {instWarehouses.map((wh) => (
                    <label key={wh.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formWarehouseIds.includes(wh.id)}
                        onChange={() => toggleWh(wh.id)}
                        className="h-3.5 w-3.5"
                      />
                      {wh.name}
                      <span className="text-[10px] text-muted-foreground">({wh.type})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

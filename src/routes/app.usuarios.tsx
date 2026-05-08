import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore, ROLE_DISPLAY, type AppRole } from "@/lib/store";
import { requireAdmin } from "@/lib/route-guards";
import type { WorkspaceUser } from "@/lib/domain-types";

export const Route = createFileRoute("/app/usuarios")({
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Meditory — Usuarios" }] }),
  component: UsuariosPage,
});

const ROLE_BADGE_VARIANT: Record<AppRole, "default" | "secondary" | "outline" | "destructive"> = {
  admin:   "default",
  tecnico: "secondary",
  doctor:  "outline",
  ventas:  "outline",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin:   "",
  tecnico: "text-emerald-700 border-emerald-300 bg-emerald-50",
  doctor:  "text-violet-700 border-violet-300 bg-violet-50",
  ventas:  "text-amber-700 border-amber-300 bg-amber-50",
};

type UserForm = { name: string; email: string; role: AppRole };
const EMPTY_FORM: UserForm = { name: "", email: "", role: "ventas" };

function UsuariosPage() {
  const session = useStore((s) => s.session);
  const users = useStore((s) => s.users);
  const warehouses = useStore((s) => s.warehouses);
  const userWarehouseAccesses = useStore((s) => s.userWarehouseAccesses);
  const addUser = useStore((s) => s.addUser);
  const updateUser = useStore((s) => s.updateUser);
  const deleteUser = useStore((s) => s.deleteUser);

  const workspaceUsers = users.filter((u) => u.workspaceId === session?.workspaceId);

  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const countByRole = (role: AppRole) => workspaceUsers.filter((u) => u.role === role).length;

  function openAdd() {
    setForm(EMPTY_FORM);
    setSelectedWarehouseIds([]);
    setEditingId(null);
    setDialogMode("add");
  }

  function openEdit(user: WorkspaceUser) {
    setForm({ name: user.name, email: user.email, role: user.role });
    setSelectedWarehouseIds(
      userWarehouseAccesses
        .filter((access) => access.userId === user.id)
        .map((access) => access.warehouseId),
    );
    setEditingId(user.id);
    setDialogMode("edit");
  }

  async function handleSave() {
    if (savingUser) return;
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    try {
      setSavingUser(true);
      if (dialogMode === "add") {
        await addUser({
          ...form,
          name: form.name.trim(),
          workspaceId: session!.workspaceId,
          warehouseIds: selectedWarehouseIds,
        });
        toast.success("Usuario creado correctamente.");
      } else if (editingId) {
        if (editingId === users.find((u) => u.email === session?.email)?.id && form.role !== "admin") {
          toast.error("No podés quitarte el rol de admin a vos mismo.");
          return;
        }
        await updateUser(editingId, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          warehouseIds: selectedWarehouseIds,
        });
        toast.success("Usuario actualizado.");
      }
      setDialogMode(null);
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingUser) return;
    const target = users.find((u) => u.id === id);
    if (target?.email === session?.email) {
      toast.error("No podés eliminar tu propia cuenta.");
      return;
    }
    try {
      setDeletingUser(true);
      await deleteUser(id);
      setDeleteConfirm(null);
      toast.success("Usuario eliminado.");
    } finally {
      setDeletingUser(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de usuarios de {session?.workspaceName}
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["admin", "tecnico", "doctor", "ventas"] as AppRole[]).map((role) => (
          <Card key={role}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{countByRole(role)}</p>
                <p className="text-xs text-muted-foreground">{ROLE_DISPLAY[role]}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {workspaceUsers.length} usuario{workspaceUsers.length !== 1 ? "s" : ""} registrado{workspaceUsers.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaceUsers.map((user) => {
                const isSelf = user.email === session?.email;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {isSelf && (
                        <span className="ml-2 text-[10px] text-muted-foreground">(vos)</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ROLE_BADGE_VARIANT[user.role]}
                        className={ROLE_COLORS[user.role]}
                      >
                        {ROLE_DISPLAY[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isSelf}
                          onClick={() => setDeleteConfirm(user.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Nuevo usuario" : "Editar usuario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Nombre y apellido"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="usuario@hospital.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_DISPLAY) as [AppRole, string][]).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Depósitos con acceso</Label>
              <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-2">
                {warehouses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay depósitos creados en el workspace.
                  </p>
                ) : (
                  warehouses.map((warehouse) => {
                    const checked = selectedWarehouseIds.includes(warehouse.id);
                    return (
                      <label key={warehouse.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSelectedWarehouseIds((current) =>
                              isChecked
                                ? [...current, warehouse.id]
                                : current.filter((id) => id !== warehouse.id),
                            );
                          }}
                        />
                        <span>{warehouse.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={savingUser}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={savingUser}
              className={savingUser ? "bg-muted text-muted-foreground hover:bg-muted" : undefined}
            >
              {savingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : dialogMode === "add" ? "Crear usuario" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que querés eliminar a{" "}
            <span className="font-medium text-foreground">
              {users.find((u) => u.id === deleteConfirm)?.name}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deletingUser}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deletingUser}
            >
              {deletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

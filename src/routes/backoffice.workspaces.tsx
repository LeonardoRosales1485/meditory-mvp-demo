import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackofficeStore } from "@/lib/backoffice-store";
import { useMobileListView } from "@/lib/use-mobile-list-view";

export const Route = createFileRoute("/backoffice/workspaces")({
  component: BackofficeWorkspacesPage,
});

interface Institucion {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

function BackofficeWorkspacesPage() {
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loading, setLoading] = useState(true);
  const { isMobile, viewMode, setViewMode } = useMobileListView("backoffice-workspaces");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Institucion | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { backofficeListWorkspacesRpc } = await import("@/lib/server-rpc");
      const result = await backofficeListWorkspacesRpc();
      setInstituciones(result as Institucion[]);
    } catch (e) {
      toast.error("Error al cargar instituciones", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setDialogOpen(true);
  }

  function openEdit(ws: Institucion) {
    setEditing(ws);
    setName(ws.name);
    setSlug(ws.slug);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !slug.trim()) {
      toast.error("Completá nombre y slug");
      return;
    }
    setSaving(true);
    try {
      const { backofficeCreateWorkspaceRpc, backofficeUpdateWorkspaceRpc } = await import("@/lib/server-rpc");
      if (editing) {
        await backofficeUpdateWorkspaceRpc({ data: { id: editing.id, patch: { name: name.trim(), slug: slug.trim() } } });
        toast.success("Institución actualizada");
      } else {
        await backofficeCreateWorkspaceRpc({ data: { name: name.trim(), slug: slug.trim() } });
        toast.success("Institución creada");
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

  async function handleDelete(ws: Institucion) {
    if (!confirm(`¿Eliminar "${ws.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const { backofficeDeleteWorkspaceRpc } = await import("@/lib/server-rpc");
      await backofficeDeleteWorkspaceRpc({ data: { id: ws.id } });
      toast.success("Institución eliminada");
      await load();
    } catch (e) {
      toast.error("Error al eliminar", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Instituciones</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo
        </Button>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : instituciones.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay instituciones.</p>
          ) : (
            <>
              {isMobile && (
                <div className="px-4 pb-3 pt-1">
                  <MobileViewToggle value={viewMode} onChange={setViewMode} />
                </div>
              )}
              {isMobile && viewMode === "cards" ? (
                <div className="space-y-3 px-4 pb-4">
                  {instituciones.map((ws) => (
                    <Card key={ws.id} className="shadow-sm">
                      <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ws)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(ws)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p>Slug: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ws.slug}</code></p>
                        <p>Creado: {new Date(ws.created_at).toLocaleDateString("es-AR")}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="w-24">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instituciones.map((ws) => (
                      <TableRow key={ws.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{ws.id}</TableCell>
                        <TableCell className="font-medium">{ws.name}</TableCell>
                        <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ws.slug}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(ws.created_at).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ws)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(ws)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Institución" : "Nueva Institución"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hospital Nuevo" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="HOSPITALNUEVO"
                disabled={!!editing}
              />
              <p className="text-[11px] text-muted-foreground">Identificador único en mayúsculas, sin espacios.</p>
            </div>
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

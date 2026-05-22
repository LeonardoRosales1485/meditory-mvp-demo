import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MobileViewToggle } from "@/components/mobile-view-toggle";
import { PageHeader } from "@/components/page-header";
import { WorkspaceLoadingPlaceholder } from "@/components/workspace-loading-placeholder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { medConc, type Medication } from "@/lib/domain-types";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { requireAdminOrVentas } from "@/lib/route-guards";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/lista-precios")({
  beforeLoad: requireAdminOrVentas,
  head: () => ({ meta: [{ title: "Meditory — Listas de precios" }] }),
  component: ListaPreciosPage,
});

function formatArs(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ListaPrecioRow({
  m,
  canEdit,
  inputValue,
  onInputValueChange,
  onSavedToServer,
}: {
  m: Medication;
  canEdit: boolean;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onSavedToServer: (medicationId: string) => void;
}) {
  const updateMedication = useStore((s) => s.updateMedication);
  const [saving, setSaving] = useState(false);
  const [togglingSale, setTogglingSale] = useState(false);

  async function toggleSaleEnabled(next: boolean) {
    if (!canEdit || togglingSale) return;
    setTogglingSale(true);
    try {
      await updateMedication(m.id, { saleEnabled: next });
      toast.success(next ? "Venta en mostrador habilitada" : "Venta en mostrador deshabilitada", {
        description: next
          ? "El medicamento vuelve a mostrarse en Ventas cuando haya stock."
          : "El medicamento ya no aparece en Ventas hasta que lo reactives.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo actualizar.";
      toast.error("No se pudo cambiar la venta en mostrador", { description: msg });
    } finally {
      setTogglingSale(false);
    }
  }

  async function save() {
    const n = parseFloat(inputValue.replace(",", ".").trim());
    if (Number.isNaN(n) || n < 0) {
      toast.error("Precio inválido", { description: "Ingresá un número mayor o igual a cero." });
      return;
    }
    setSaving(true);
    try {
      await updateMedication(m.id, { salePrice: n });
      onSavedToServer(m.id);
      toast.success("Precio de lista actualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar.";
      toast.error("Error al guardar precio", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  const saleOn = m.saleEnabled !== false;

  return (
    <TableRow>
      <TableCell className="font-medium">{m.name}</TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{medConc(m)}</TableCell>
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{m.form}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            checked={saleOn}
            onChange={(e) => void toggleSaleEnabled(e.target.checked)}
            disabled={!canEdit || togglingSale}
            aria-label={`Venta en mostrador: ${m.name}`}
            title={
              canEdit
                ? "Si está desmarcado, el medicamento no aparece en Ventas y no se puede vender."
                : "Solo administración puede cambiar esta opción."
            }
          />
          <span className="text-xs text-muted-foreground sm:text-sm">{saleOn ? "Sí" : "No"}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-muted-foreground sm:hidden">$</span>
            <Input
              className="h-8 w-24 text-right tabular-nums sm:w-28"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => onInputValueChange(e.target.value)}
              aria-label={`Precio venta ${m.name}`}
            />
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        ) : (
          <span className="tabular-nums">${formatArs(m.salePrice)}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function ListaPreciosPage() {
  const session = useStore((s) => s.session);
  const role = session?.role;
  const medications = useStore((s) => s.medications);
  const workspaceDataLoading = useStore((s) => s.workspaceDataLoading);
  const [listaPrecioDraftByMedId, setListaPrecioDraftByMedId] = useState<Record<string, string>>({});
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-lista-precios");

  const medicationsSorted = useMemo(
    () =>
      [...medications]
        .filter((m) => !m.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [medications],
  );

  const showLoading = workspaceDataLoading && medications.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Listas de precios"
        description="Precio unitario de mostrador por medicamento del catálogo. La columna «Venta mostrador» indica si el ítem aparece en Ventas; cada venta guarda el precio vigente al registrarla."
      />

      {showLoading ? (
        <WorkspaceLoadingPlaceholder
          title="Cargando catálogo"
          description="Sincronizando medicamentos y precios de la Institución…"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catálogo y precios</CardTitle>
            <p className="text-sm text-muted-foreground">
              Administración puede editar precios, habilitar o deshabilitar la venta en mostrador por medicamento, y
              guardar precios por fila. El perfil ventas ve la lista de referencia. Desde{" "}
              <span className="font-medium text-foreground">Ventas</span> solo aparecen medicamentos con venta
              habilitada y stock en el depósito; el precio es el guardado aquí al registrar cada venta.
            </p>
          </CardHeader>
          <CardContent className="px-0">
            {isMobile && (
              <div className="px-4 pb-3 pt-1">
                <MobileViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            {isMobile && viewMode === "cards" ? (
              <div className="space-y-3 px-4 pb-4">
                {medicationsSorted.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay medicamentos en el catálogo de este workspace.
                  </p>
                ) : (
                  medicationsSorted.map((m) => {
                    const inputValue = listaPrecioDraftByMedId[m.id] ?? String(m.salePrice);
                    const canEdit = role === "admin";
                    const saleOn = m.saleEnabled !== false;
                    return (
                      <Card key={m.id} className="shadow-sm">
                        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                          <p className="text-sm font-semibold text-foreground">{m.name}</p>
                          <p>{medConc(m)} · {m.form}</p>
                          <div className="flex items-center gap-2">
                            <span>Venta mostrador:</span>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                              checked={saleOn}
                              disabled={!canEdit}
                              aria-label={`Venta en mostrador: ${m.name}`}
                            />
                            <span>{saleOn ? "Sí" : "No"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>Precio:</span>
                            {canEdit ? (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">$</span>
                                <Input
                                  className="h-8 w-24 text-right tabular-nums"
                                  inputMode="decimal"
                                  value={inputValue}
                                  onChange={(e) =>
                                    setListaPrecioDraftByMedId((prev) => ({ ...prev, [m.id]: e.target.value }))
                                  }
                                />
                              </div>
                            ) : (
                              <span className="tabular-nums font-semibold text-foreground">
                                ${Number(m.salePrice).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicamento</TableHead>
                      <TableHead className="hidden sm:table-cell">Concentración</TableHead>
                      <TableHead className="hidden md:table-cell">Forma</TableHead>
                      <TableHead className="w-[140px]">Venta mostrador</TableHead>
                      <TableHead className="text-right">Precio venta ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicationsSorted.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No hay medicamentos en el catálogo de este workspace.
                        </TableCell>
                      </TableRow>
                    ) : (
                      medicationsSorted.map((m) => (
                        <ListaPrecioRow
                          key={m.id}
                          m={m}
                          canEdit={role === "admin"}
                          inputValue={listaPrecioDraftByMedId[m.id] ?? String(m.salePrice)}
                          onInputValueChange={(v) =>
                            setListaPrecioDraftByMedId((prev) => ({ ...prev, [m.id]: v }))
                          }
                          onSavedToServer={(medicationId) =>
                            setListaPrecioDraftByMedId((prev) => {
                              const next = { ...prev };
                              delete next[medicationId];
                              return next;
                            })
                          }
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

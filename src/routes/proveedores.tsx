import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, LogOut, FileText, DollarSign, Calendar,
  Package, Clock, Building2, Search, CheckCircle, AlertCircle,
  ArrowLeft, Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type {
  ProveedorRow, LicitacionRow, LicitacionItemRow, LicitacionOfertaRow,
} from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/proveedores")({
  component: ProveedoresPage,
});

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  en_licitacion: "En Licitación",
  ofertas_recibidas: "Ofertas Recibidas",
  adjudicado: "Adjudicado",
  en_ejecucion: "En Ejecución",
  completado: "Completado",
  cancelado: "Cancelado",
};

const ESTADO_COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  en_licitacion: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ofertas_recibidas: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  adjudicado: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  en_ejecucion: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const SESION_KEY = "meditory-proveedor";

function ProveedoresPage() {
  const [step, setStep] = useState<"identificar" | "dashboard">("identificar");
  const [cuit, setCuit] = useState("");
  const [cuitError, setCuitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [proveedor, setProveedor] = useState<ProveedorRow | null>(null);
  const [licitaciones, setLicitaciones] = useState<LicitacionRow[]>([]);
  const [loadingLics, setLoadingLics] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    licitacion: LicitacionRow;
    items: Array<LicitacionItemRow & { medicationName: string }>;
    miOferta: LicitacionOfertaRow | null;
  } | null>(null);
  const [ofertaMonto, setOfertaMonto] = useState("");
  const [ofertaPlazo, setOfertaPlazo] = useState("30");
  const [ofertaObs, setOfertaObs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESION_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved) as ProveedorRow;
        setProveedor(p);
        setStep("dashboard");
      } catch {
        sessionStorage.removeItem(SESION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (step === "dashboard" && proveedor && licitaciones.length === 0 && !loadingLics) {
      loadLicitaciones();
    }
  }, [step, proveedor]);

  async function handleIdentify() {
    const trimmed = cuit.trim();
    if (!trimmed) {
      setCuitError("Ingresá un CUIT");
      return;
    }
    setLoading(true);
    setCuitError("");
    try {
      const rpc = await import("@/lib/server-rpc");
      const result = await rpc.proveedoresIdentifyRpc({ data: { cuit: trimmed } });
      if (!result) {
        setCuitError("CUIT no registrado. Contactá al administrador del sistema.");
        return;
      }
      const p = result as ProveedorRow;
      setProveedor(p);
      sessionStorage.setItem(SESION_KEY, JSON.stringify(p));
      setStep("dashboard");
    } catch {
      setCuitError("Error al verificar CUIT. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLicitaciones() {
    setLoadingLics(true);
    try {
      const rpc = await import("@/lib/server-rpc");
      const result = await rpc.proveedoresGetLicitacionesRpc();
      setLicitaciones(result as LicitacionRow[]);
    } catch {
      toast.error("Error al cargar licitaciones");
    } finally {
      setLoadingLics(false);
    }
  }

  async function openDetail(lic: LicitacionRow) {
    setDetailId(lic.id);
    setOfertaMonto("");
    setOfertaPlazo("30");
    setOfertaObs("");
    try {
      const rpc = await import("@/lib/server-rpc");
      const [detail, miOferta] = await Promise.all([
        rpc.proveedoresGetLicitacionDetailRpc({ data: { id: lic.id } }),
        proveedor ? rpc.proveedoresGetMiOfertaRpc({
          data: { licitacionId: lic.id, proveedorId: proveedor.id },
        }) : null,
      ]);
      setDetailData({
        ...(detail as typeof detailData),
        miOferta: (miOferta as LicitacionOfertaRow | null) ?? null,
      });
    } catch {
      toast.error("Error al cargar detalle");
      setDetailId(null);
    }
  }

  async function handleSubmitOferta() {
    if (!detailData || !proveedor) return;
    const monto = parseFloat(ofertaMonto.replace(/[.,]/g, (m) => m === "." ? "" : "."));
    if (!monto || monto <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    const plazo = parseInt(ofertaPlazo, 10);
    if (!plazo || plazo < 1) {
      toast.error("Ingresá un plazo válido en días");
      return;
    }
    setSubmitting(true);
    try {
      const rpc = await import("@/lib/server-rpc");
      const result = await rpc.proveedoresCrearOfertaRpc({
        data: {
          licitacion_id: detailData.licitacion.id,
          proveedor_id: proveedor.id,
          monto_total: monto,
          plazo_entrega_dias: plazo,
          observaciones: ofertaObs.trim(),
        },
      });
      setDetailData((prev) => prev ? { ...prev, miOferta: result as LicitacionOfertaRow } : prev);
      toast.success("Propuesta enviada con éxito");
    } catch {
      toast.error("Error al enviar la propuesta");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESION_KEY);
    setProveedor(null);
    setLicitaciones([]);
    setStep("identificar");
    setCuit("");
  }

  function volverAlDashboard() {
    setDetailId(null);
    setDetailData(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Meditory</span>
          <span className="text-xs text-muted-foreground">· Portal de Proveedores</span>
          <div className="ml-auto flex items-center gap-3">
            {proveedor && (
              <>
                <span className="text-xs text-muted-foreground">{proveedor.nombre}</span>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleLogout}>
                  <LogOut size={12} /> Salir
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {step === "identificar" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-sm space-y-6 pt-16">
            <div className="space-y-2 text-center">
              <Building2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="text-xl font-bold">Portal de Proveedores</h1>
              <p className="text-sm text-muted-foreground">
                Ingresá tu CUIT para acceder a las licitaciones disponibles y presentar tus propuestas.
              </p>
            </div>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="cuit" className="text-xs">CUIT</Label>
                  <Input
                    id="cuit"
                    placeholder="XX-XXXXXXXX-X"
                    value={cuit}
                    onChange={(e) => { setCuit(e.target.value); setCuitError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleIdentify(); }}
                    className="text-sm"
                  />
                  {cuitError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {cuitError}
                    </p>
                  )}
                </div>
                <Button className="w-full gap-2" onClick={handleIdentify} disabled={loading}>
                  {loading ? "Verificando..." : "Ingresar"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "dashboard" && !detailId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Licitaciones Abiertas</h1>
                <p className="text-sm text-muted-foreground">
                  {licitaciones.length} licitaciones disponibles para presentar propuestas
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={loadLicitaciones} disabled={loadingLics}>
                <Search size={12} /> Actualizar
              </Button>
            </div>

            {loadingLics ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Cargando licitaciones...</p>
            ) : licitaciones.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No hay licitaciones abiertas en este momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {licitaciones.map((lic) => (
                  <Card key={lic.id} className="transition-all hover:shadow-md">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{lic.codigo}</span>
                          <Badge className={`text-[10px] border-0 ${ESTADO_COLORS[lic.estado]}`}>
                            {ESTADO_LABELS[lic.estado]}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium leading-tight">{lic.titulo}</p>
                        {lic.fecha_limite_ofertas && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={10} />
                            Cierre: {new Date(lic.fecha_limite_ofertas).toLocaleDateString("es-AR")}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={() => openDetail(lic)}>
                        Ver detalle
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === "dashboard" && detailId && detailData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={volverAlDashboard}>
              <ArrowLeft size={14} /> Volver a licitaciones
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{detailData.licitacion.codigo}</span>
                  <Badge className={`text-[10px] border-0 ${ESTADO_COLORS[detailData.licitacion.estado]}`}>
                    {ESTADO_LABELS[detailData.licitacion.estado]}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{detailData.licitacion.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {detailData.licitacion.descripcion && (
                  <p className="text-xs text-muted-foreground">{detailData.licitacion.descripcion}</p>
                )}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {detailData.licitacion.fecha_limite_ofertas && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Cierre: {new Date(detailData.licitacion.fecha_limite_ofertas).toLocaleDateString("es-AR")}
                    </span>
                  )}
                  {detailData.licitacion.fecha_estimada_entrega && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Entrega estimada: {new Date(detailData.licitacion.fecha_estimada_entrega).toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Medicamento</TableHead>
                        <TableHead className="text-xs text-right">Cantidad</TableHead>
                        <TableHead className="text-xs text-right">Precio Unit. Est.</TableHead>
                        <TableHead className="text-xs">Justificación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                          <TableCell className="text-right text-sm">{item.cantidad_solicitada.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            ${item.precio_unitario_estimado.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.justificacion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {detailData.miOferta ? "Mi propuesta presentada" : "Presentar propuesta"}
                  </h3>

                  {detailData.miOferta ? (
                    <Card className="bg-muted/50">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">Propuesta enviada</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Monto total:</span>
                            <p className="font-medium">${detailData.miOferta.monto_total.toLocaleString("es-AR")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Plazo de entrega:</span>
                            <p className="font-medium">{detailData.miOferta.plazo_entrega_dias} días</p>
                          </div>
                          {detailData.miOferta.observaciones && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Observaciones:</span>
                              <p>{detailData.miOferta.observaciones}</p>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Presentada:</span>
                            <p>{new Date(detailData.miOferta.fecha_presentacion).toLocaleDateString("es-AR", {
                              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Monto total ($)</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={ofertaMonto}
                            onChange={(e) => setOfertaMonto(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Plazo de entrega (días)</Label>
                          <Input
                            type="number"
                            placeholder="30"
                            value={ofertaPlazo}
                            onChange={(e) => setOfertaPlazo(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Observaciones (opcional)</Label>
                        <Textarea
                          placeholder="Detalles adicionales sobre la propuesta..."
                          value={ofertaObs}
                          onChange={(e) => setOfertaObs(e.target.value)}
                          className="text-sm"
                          rows={3}
                        />
                      </div>
                      <Button className="w-full gap-2" onClick={handleSubmitOferta} disabled={submitting}>
                        {submitting ? "Enviando..." : <><Send size={14} /> Enviar propuesta</>}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Meditory &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

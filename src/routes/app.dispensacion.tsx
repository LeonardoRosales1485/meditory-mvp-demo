import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/route-guards";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, medName } from "@/lib/domain-types";
import { stockFor, useStore } from "@/lib/store";
import { useWarehouse } from "@/lib/warehouse-context";
import { useMobileListView } from "@/lib/use-mobile-list-view";
import { MobileViewToggle } from "@/components/mobile-view-toggle";

export const Route = createFileRoute("/app/dispensacion")({
  beforeLoad: () => {
    throw redirect({ to: "/app/pedidos" });
  },
  component: Dispensing,
});

function Dispensing() {
  const { warehouse, setWarehouse, warehouses } = useWarehouse();
  const dispensations = useStore((s) => s.dispensations);
  const batches = useStore((s) => s.batches);
  const medications = useStore((s) => s.medications);
  const catalogMedications = useMemo(() => medications.filter((m) => !m.deletedAt), [medications]);
  const addDispensation = useStore((s) => s.addDispensation);

  const [open, setOpen] = useState(false);
  const [med, setMed] = useState("");
  const [qty, setQty] = useState("1");
  const [doctor, setDoctor] = useState("");
  const [patient, setPatient] = useState("");
  const [room, setRoom] = useState("");
  const [treatment, setTreatment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isMobile, viewMode, setViewMode } = useMobileListView("app-dispensacion");

  const available = med ? stockFor(batches, med, warehouse.id) : 0;

  function reset() {
    setMed(""); setQty("1"); setDoctor(""); setPatient(""); setRoom(""); setTreatment("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!med || !doctor || !patient || !room || !treatment) {
      return toast.error("Completá todos los campos");
    }
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(quantity) || quantity <= 0) return toast.error("Cantidad inválida");
    if (available < quantity) {
      return toast.error("Stock insuficiente", { description: `Disponible: ${available} u en ${warehouse.name}` });
    }
    try {
      setSubmitting(true);
      await addDispensation({
        medicationId: med,
        warehouseId: warehouse.id,
        quantity,
        doctor,
        patient,
        room,
        treatment,
      });
      toast.success("Dispensación registrada");
      setOpen(false);
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Dispensación interna"
        description={`Egresos a salas. Operando en ${warehouse.name}.`}
        action={
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {warehouses.length > 1 && (
              <Select value={warehouse.id} onValueChange={(id) => setWarehouse(warehouses.find((w) => w.id === id)!)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">Nueva dispensación</Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar dispensación</DialogTitle>
                <DialogDescription>
                  El stock se descuenta del depósito activo. Doctor, paciente y tratamiento quedan auditados.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Medicamento</Label>
                  <Select value={med} onValueChange={setMed}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {catalogMedications.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.concentrationValue}{m.concentrationUnit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {med && (
                    <p className="text-xs text-muted-foreground">Stock disponible: {available} u</p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sala</Label>
                    <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Sala 12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Doctor</Label>
                  <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. Gómez" />
                </div>
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Input value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Apellido, Nombre" />
                </div>
                <div className="space-y-2">
                  <Label>Tratamiento / motivo</Label>
                  <Textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={2} />
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={submitting ? "bg-muted text-muted-foreground hover:bg-muted" : undefined}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />
      <Card>
        <CardContent className="px-0">
          {isMobile && (
            <div className="px-3 pb-3">
              <MobileViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
          {isMobile && viewMode === "cards" ? (
            <div className="space-y-3 p-3">
              {dispensations.map((d) => (
                <Card key={d.id}>
                  <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
                    <p className="text-sm font-semibold text-foreground">{medName(d.medicationId)}</p>
                    <p>Cantidad: {d.quantity} u</p>
                    <p>Doctor: {d.doctor}</p>
                    <p>Paciente: {d.patient}</p>
                    <p>Sala: {d.room}</p>
                    <p>Tratamiento: {d.treatment}</p>
                    <p>Fecha: {formatDate(d.date)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicamento</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="hidden md:table-cell">Doctor</TableHead>
                <TableHead className="hidden md:table-cell">Paciente</TableHead>
                <TableHead className="hidden lg:table-cell">Sala</TableHead>
                <TableHead className="hidden lg:table-cell">Tratamiento</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispensations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{medName(d.medicationId)}</TableCell>
                  <TableCell className="text-right">{d.quantity}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{d.doctor}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{d.patient}</TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{d.room}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{d.treatment}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(d.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

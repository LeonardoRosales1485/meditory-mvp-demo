import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BedDouble, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useStore } from "@/lib/store";
import { WING_TYPE_LABEL, type Patient, type Room, type Wing } from "@/lib/domain-types";

const NONE = "__none__";

function patientLabel(p: Patient) {
  return `${p.lastName}, ${p.firstName}`;
}

function firstFreeBedId(room: Room | undefined): string {
  if (!room) return "";
  const free = room.beds.find((b) => !b.patientId);
  return free?.id ?? "";
}

function PatientSearchField({
  patients,
  selectedId,
  onSelect,
  disabled,
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = patients.find((p) => p.id === selectedId);
  const displayValue = selected ? patientLabel(selected) : q;

  const updateMenuPos = useCallback(() => {
    const input = wrapRef.current?.querySelector("input");
    if (!input) return;
    const r = input.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const filtered = useMemo(() => {
    const t = (selected && !open ? "" : q).trim().toLowerCase();
    if (!t) return [...patients].slice(0, 20);
    return patients
      .filter((p) => {
        const full = patientLabel(p).toLowerCase();
        return full.includes(t) || p.firstName.toLowerCase().includes(t) || p.lastName.toLowerCase().includes(t);
      })
      .slice(0, 25);
  }, [patients, q, selected, open]);

  useLayoutEffect(() => {
    if (!open || patients.length === 0) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    window.addEventListener("scroll", updateMenuPos, true);
    window.addEventListener("resize", updateMenuPos);
    return () => {
      window.removeEventListener("scroll", updateMenuPos, true);
      window.removeEventListener("resize", updateMenuPos);
    };
  }, [open, patients.length, updateMenuPos, filtered.length, q]);

  const list =
    open && patients.length > 0 && menuPos ? (
      <ul
        className="pointer-events-auto max-h-52 overflow-auto rounded-md border border-border bg-background shadow-md"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 10_050,
        }}
        role="listbox"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>
        ) : (
          filtered.map((p) => (
            <li key={p.id} className="border-b border-border last:border-0">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p.id);
                  setQ("");
                  setOpen(false);
                }}
              >
                {patientLabel(p)}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={wrapRef} className="relative space-y-1.5">
      <Label>Paciente</Label>
      <Input
        value={displayValue}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          if (selectedId) onSelect("");
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          queueMicrotask(updateMenuPos);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Buscar por apellido o nombre…"
        autoComplete="off"
      />
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </div>
  );
}

export function RegisterInternmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useStore((s) => s.session);
  const patients = useStore((s) => s.patients);
  const wings = useStore((s) => s.wings);
  const rooms = useStore((s) => s.rooms);
  const assignBed = useStore((s) => s.assignBed);

  const [patientId, setPatientId] = useState("");
  const [wingId, setWingId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [saving, setSaving] = useState(false);

  const workspaceId = session?.workspaceId ?? "";

  const workspaceWings = useMemo(
    () => wings.filter((w) => w.workspaceId === workspaceId).sort((a, b) => a.prefix - b.prefix),
    [wings, workspaceId],
  );

  const workspaceRooms = useMemo(
    () => rooms.filter((r) => r.workspaceId === workspaceId),
    [rooms, workspaceId],
  );

  const selectablePatients = useMemo(() => {
    return patients
      .filter((p) => p.workspaceId === workspaceId)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [patients, workspaceId]);

  const roomsWithFreeBed = useMemo(() => {
    return workspaceRooms.filter((r) => r.beds.some((b) => !b.patientId));
  }, [workspaceRooms]);

  const filteredRooms = useMemo(() => {
    if (!wingId) return [...roomsWithFreeBed].sort((a, b) => a.fullNumber - b.fullNumber);
    return roomsWithFreeBed.filter((r) => r.wingId === wingId).sort((a, b) => a.fullNumber - b.fullNumber);
  }, [roomsWithFreeBed, wingId]);

  const wingById = useMemo(() => {
    const m = new Map<string, Wing>();
    workspaceWings.forEach((w) => m.set(w.id, w));
    return m;
  }, [workspaceWings]);

  const selectedRoom = workspaceRooms.find((r) => r.id === roomId);

  useEffect(() => {
    if (!roomId) {
      setBedId("");
      return;
    }
    const r = workspaceRooms.find((x) => x.id === roomId);
    setBedId(firstFreeBedId(r));
  }, [roomId, workspaceRooms]);

  const resetForm = useCallback(() => {
    setPatientId("");
    setWingId("");
    setRoomId("");
    setBedId("");
    setSaving(false);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  async function submit() {
    if (!patientId) {
      toast.error("Seleccioná un paciente.");
      return;
    }
    if (!roomId || !bedId) {
      toast.error("Seleccioná una sala con disponibilidad y una cama.");
      return;
    }
    const room = workspaceRooms.find((r) => r.id === roomId);
    const bed = room?.beds.find((b) => b.id === bedId);
    if (!room || !bed || bed.patientId) {
      toast.error("La cama ya no está disponible. Elegí otra.");
      return;
    }
    setSaving(true);
    try {
      await assignBed(bedId, patientId);
      toast.success("Internación registrada", {
        description: `Sala ${room.fullNumber} · Cama ${bed.position}`,
      });
      handleOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo asignar la cama.";
      toast.error("Error", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            Registrar internación
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <PatientSearchField
            patients={selectablePatients}
            selectedId={patientId}
            onSelect={setPatientId}
            disabled={saving}
          />

          <div className="space-y-1.5">
            <Label>Ala</Label>
            <Select
              value={wingId || NONE}
              disabled={saving || workspaceWings.length === 0}
              onValueChange={(v) => {
                setWingId(v === NONE ? "" : v);
                setRoomId("");
                setBedId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={workspaceWings.length === 0 ? "Sin alas" : "Todas las alas"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todas las alas</SelectItem>
                {workspaceWings.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({WING_TYPE_LABEL[w.type]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sala</Label>
            <Select
              value={roomId || NONE}
              disabled={saving || filteredRooms.length === 0}
              onValueChange={(v) => {
                const id = v === NONE ? "" : v;
                setRoomId(id);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    roomsWithFreeBed.length === 0
                      ? "No hay salas con cama libre"
                      : "Elegí sala"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredRooms.map((r) => {
                  const w = wingById.get(r.wingId);
                  const free = r.beds.filter((b) => !b.patientId).length;
                  return (
                    <SelectItem key={r.id} value={r.id}>
                      Sala {r.fullNumber}
                      {w ? ` · ${w.name}` : ""} · {free} libre{free === 1 ? "" : "s"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {roomId ? (
              <p className="break-all font-mono text-[11px] text-muted-foreground">room_id: {roomId}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Cama</Label>
            <Select
              value={bedId || NONE}
              disabled={saving || !selectedRoom}
              onValueChange={(v) => setBedId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={!roomId ? "Elegí una sala primero" : "Cama"} />
              </SelectTrigger>
              <SelectContent>
                {selectedRoom?.beds
                  .filter((b) => !b.patientId)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      Cama {b.position}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {workspaceWings.length === 0 && (
            <p className="text-xs text-amber-700">
              No hay alas ni salas en este workspace. Configurá internación en <strong>Salas</strong>.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Guardando...
              </>
            ) : (
              "Confirmar internación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

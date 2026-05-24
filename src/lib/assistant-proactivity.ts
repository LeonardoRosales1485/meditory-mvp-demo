import type { Batch, MedicationOrder, TransferRequest, Patient } from "./domain-types";

export type Suggestion = {
  id: string;
  label: string;
  description: string;
  action: string;
  priority: "alta" | "media" | "baja";
};

export interface ProactivityInput {
  medications: { id: string; name: string; activeIngredient: string }[];
  warehouses: { id: string; name: string; type: string }[];
  batches: Batch[];
  orders: MedicationOrder[];
  transfers: TransferRequest[];
  patients: Patient[];
  stockConfigs: { medicationId: string; warehouseId: string; minStock: number; optimalStock: number }[];
  stockByMedicationWarehouse: Record<string, number>;
}

function key(mId: string, wId: string): string {
  return `${mId}::${wId}`;
}

export function analyzeAndSuggest(input: ProactivityInput): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const criticalBatches = input.batches.filter((b) => {
    const expiry = new Date(b.expiry).getTime();
    return expiry > now && expiry <= in30Days;
  });
  if (criticalBatches.length > 0) {
    const medNames = criticalBatches.slice(0, 3).map((b) => {
      const m = input.medications.find((m) => m.id === b.medicationId);
      return m?.name ?? b.medicationId;
    });
    suggestions.push({
      id: "critical-expiries",
      label: `${criticalBatches.length} lotes próximos a vencer`,
      description: `${criticalBatches.length} lotes vencen en menos de 30 días. Revisá vencimientos para planificar.`,
      action: `Hay ${criticalBatches.length} lotes por vencer pronto (ej: ${medNames.join(", ")}). ¿Querés ver el detalle?`,
      priority: "alta",
    });
  }

  const pendingOrders = input.orders.filter((o) => o.status === "pendiente" || o.status === "aprobado");
  if (pendingOrders.length > 0) {
    suggestions.push({
      id: "pending-orders",
      label: `${pendingOrders.length} pedidos pendientes`,
      description: `${pendingOrders.length} pedidos requieren atención (pendientes/aprobados).`,
      action: `Tenés ${pendingOrders.length} pedidos pendientes de procesar. ¿Querés revisarlos?`,
      priority: "alta",
    });
  }

  const pendingTransfers = input.transfers.filter((t) => {
    const terminal = new Set(["aceptado", "rechazado"]);
    return !terminal.has(t.status);
  });
  if (pendingTransfers.length > 0) {
    const readyToReceive = pendingTransfers.filter((t) => t.status === "despachado" || t.status === "recibir");
    const detail = readyToReceive.length > 0
      ? ` (${readyToReceive.length} listas para recibir)`
      : "";
    suggestions.push({
      id: "pending-transfers",
      label: `${pendingTransfers.length} transferencias en curso${detail}`,
      description: `${pendingTransfers.length} transferencias activas${detail}.`,
      action: `Hay ${pendingTransfers.length} transferencias activas${detail}. ¿Querés ver su estado?`,
      priority: "media",
    });
  }

  const lowStockAlerts: string[] = [];
  for (const cfg of input.stockConfigs) {
    const k = key(cfg.medicationId, cfg.warehouseId);
    const current = input.stockByMedicationWarehouse[k] ?? 0;
    if (current < cfg.minStock) {
      const med = input.medications.find((m) => m.id === cfg.medicationId);
      const wh = input.warehouses.find((w) => w.id === cfg.warehouseId);
      lowStockAlerts.push(`${med?.name ?? cfg.medicationId} en ${wh?.name ?? cfg.warehouseId}: ${current}/${cfg.minStock}`);
    }
  }
  if (lowStockAlerts.length > 0) {
    const top = lowStockAlerts.slice(0, 3);
    suggestions.push({
      id: "low-stock",
      label: `${lowStockAlerts.length} medicamentos bajo mínimo`,
      description: `${lowStockAlerts.length} ítems están por debajo del stock mínimo.`,
      action: `${top.length} ítems bajo mínimo: ${top.join("; ")}. ¿Querés que te ayude a gestionarlos?`,
      priority: "alta",
    });
  }

  const noDoctorPatients = input.patients.filter((p) => !p.assignedDoctor || p.assignedDoctor.trim() === "");
  if (noDoctorPatients.length > 0) {
    suggestions.push({
      id: "patients-no-doctor",
      label: `${noDoctorPatients.length} pacientes sin médico asignado`,
      description: `${noDoctorPatients.length} pacientes no tienen médico a cargo.`,
      action: `${noDoctorPatients.length} pacientes no tienen médico asignado. ¿Querés actualizar sus datos?`,
      priority: "media",
    });
  }

  if (input.patients.length === 0 && input.batches.length > 0) {
    suggestions.push({
      id: "no-patients",
      label: "No hay pacientes registrados",
      description: "No hay pacientes internados. ¿Querés registrar uno?",
      action: "No hay pacientes registrados actualmente. ¿Querés internar a alguien?",
      priority: "baja",
    });
  }

  return suggestions;
}

export function getTopSuggestions(input: ProactivityInput, max = 3): Suggestion[] {
  const all = analyzeAndSuggest(input);
  const priorityOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return all.slice(0, max);
}

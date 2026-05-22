import type { Batch, Medication, Warehouse, TransferRequest } from "./domain-types";

export interface AssistantWorkspaceSnapshotInput {
  batches: Batch[];
  medications: Medication[];
  warehouses: Warehouse[];
  transfers: TransferRequest[];
  workspaceName: string;
}

function stockByMedicationId(snapshot: AssistantWorkspaceSnapshotInput): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of snapshot.batches) {
    result[b.medicationId] = (result[b.medicationId] ?? 0) + b.quantity;
  }
  return result;
}

function topMedicationsByUnits(
  snapshot: AssistantWorkspaceSnapshotInput,
  limit = 15,
): { medicationId: string; units: number; name: string }[] {
  const stock = stockByMedicationId(snapshot);
  const medMap = new Map(snapshot.medications.map((m) => [m.id, m]));
  return Object.entries(stock)
    .map(([medicationId, units]) => ({
      medicationId,
      units,
      name: medMap.get(medicationId)?.name ?? medicationId,
    }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}

function batchesSample(snapshot: AssistantWorkspaceSnapshotInput, limit = 20) {
  const now = Date.now();
  const sorted = [...snapshot.batches].sort(
    (a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime(),
  );
  return sorted.slice(0, limit).map((b) => ({
    medicationId: b.medicationId,
    warehouseId: b.warehouseId,
    lot: b.lot,
    expiry: b.expiry,
    quantity: b.quantity,
    daysUntilExpiry: Math.floor(
      (new Date(b.expiry).getTime() - now) / (1000 * 60 * 60 * 24),
    ),
  }));
}

function pendingTransfers(snapshot: AssistantWorkspaceSnapshotInput) {
  const terminal = new Set(["aceptado", "rechazado"]);
  const medMap = new Map(snapshot.medications.map((m) => [m.id, m]));
  const whMap = new Map(snapshot.warehouses.map((w) => [w.id, w]));
  return snapshot.transfers
    .filter((t) => !terminal.has(t.status))
    .map((t) => ({
      id: t.id,
      medicationName: medMap.get(t.medicationId)?.name ?? t.medicationId,
      quantity: t.quantity,
      status: t.status,
      fromWarehouseName: whMap.get(t.fromWarehouseId)?.name ?? t.fromWarehouseId,
      toWarehouseName: whMap.get(t.toWarehouseId)?.name ?? t.toWarehouseId,
    }));
}

function summary(snapshot: AssistantWorkspaceSnapshotInput) {
  const terminal = new Set(["aceptado", "rechazado"]);
  const towardReceiptStatuses = new Set(["despachado", "recibir"]);
  let towardReceiptUnits = 0;
  let pendingCount = 0;
  for (const t of snapshot.transfers) {
    if (terminal.has(t.status)) continue;
    pendingCount++;
    if (towardReceiptStatuses.has(t.status)) {
      towardReceiptUnits += t.quantity;
    }
  }
  return { pendingCount, towardReceiptUnits };
}

function wareHouseMap(snapshot: AssistantWorkspaceSnapshotInput) {
  const whMap = new Map(snapshot.warehouses.map((w) => [w.id, w]));
  const result: Record<string, { name: string; type: string; unit: string }> = {};
  for (const [id, w] of whMap) {
    result[id] = { name: w.name, type: w.type, unit: w.unit };
  }
  return result;
}

export function buildWorkspaceAssistantContext(
  snapshotInput: AssistantWorkspaceSnapshotInput,
): string {
  const ctx = {
    workspaceName: snapshotInput.workspaceName,
    stockByMedicationId: stockByMedicationId(snapshotInput),
    topMedicationsByUnits: topMedicationsByUnits(snapshotInput),
    batchesSample: batchesSample(snapshotInput),
    pendingTransfers: pendingTransfers(snapshotInput),
    summary: summary(snapshotInput),
    warehouses: wareHouseMap(snapshotInput),
    totalBatches: snapshotInput.batches.length,
    totalMedications: snapshotInput.medications.length,
  };
  return JSON.stringify(ctx, null, 2);
}

export function answerStockQueryFromSnapshot(
  snapshotInput: AssistantWorkspaceSnapshotInput,
  text: string,
): string | null {
  const lower = text.toLowerCase();
  const stock = stockByMedicationId(snapshotInput);
  const medMap = new Map(snapshotInput.medications.map((m) => [m.id, m]));

  const tokens = lower.split(/\s+/);
  const numbers = tokens.filter((t) => /^\d+$/.test(t)).map(Number);
  const queryQty = numbers.length > 0 ? numbers[0] : null;

  const matchToken = tokens.find(
    (t) =>
      t.length > 2 &&
      !["que", "las", "los", "por", "del", "con", "una", "para", "como", "cual", "donde", "cuanto", "cuantas", "cuantos", "hay", "tiene", "stock", "unidades", "unidad", "medicamento", "medicacion", "listado", "listar", "ver", "mostrar", "dame", "decime"].includes(t),
  );
  if (!matchToken) return null;

  const candidate = snapshotInput.medications
    .filter((m) => m.name.toLowerCase().includes(matchToken) || m.activeIngredient.toLowerCase().includes(matchToken))
    .sort((a, b) => a.name.length - b.name.length);

  if (candidate.length === 0) return null;

  const med = candidate[0];
  const medStock = stock[med.id] ?? 0;
  const batchesOf = snapshotInput.batches
    .filter((b) => b.medicationId === med.id)
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

  const whMap = new Map(snapshotInput.warehouses.map((w) => [w.id, w]));

  let detail = "";
  if (batchesOf.length > 0) {
    const lines = batchesOf.map(
      (b) =>
        `  · ${whMap.get(b.warehouseId)?.name ?? b.warehouseId}: lote ${b.lot} vence ${new Date(b.expiry).toLocaleDateString("es-AR")}, ${b.quantity} u`,
    );
    detail = `\nDetalle por lote:\n${lines.join("\n")}`;
  }

  const response = `**${med.name}** — stock total: **${medStock} u**.${detail}`;

  if (queryQty !== null) {
    const within = snapshotInput.batches
      .filter((b) => b.medicationId === med.id)
      .filter((b) => b.quantity >= queryQty);
    if (within.length > 0) {
      const lines = within.map(
        (b) =>
          `  · ${whMap.get(b.warehouseId)?.name ?? b.warehouseId}: lote ${b.lot}, ${b.quantity} u`,
      );
      return `${response}\n\nLotes con al menos ${queryQty} unidades:\n${lines.join("\n")}`;
    }
  }

  return response;
}

export function answerTransferPipelineFromSnapshot(
  snapshotInput: AssistantWorkspaceSnapshotInput,
  _text: string,
): string | null {
  const pend = pendingTransfers(snapshotInput);
  if (pend.length === 0) {
    return null;
  }

  const sum = summary(snapshotInput);
  const medMap = new Map(snapshotInput.medications.map((m) => [m.id, m]));

  const byStatus: Record<string, typeof pend> = {};
  for (const t of pend) {
    (byStatus[t.status] ??= []).push(t);
  }

  const lines: string[] = [];
  for (const [status, items] of Object.entries(byStatus)) {
    const detail = items
      .map(
        (t) => `  · ${t.medicationName}: ${t.quantity} u — ${t.fromWarehouseName} → ${t.toWarehouseName}`,
      )
      .join("\n");
    lines.push(`**${status}** (${items.length}):\n${detail}`);
  }

  return (
    `**Transferencias en curso:**\n${lines.join("\n")}\n\n` +
    `Resumen: ${sum.pendingCount} pendientes, ${sum.towardReceiptUnits} u próximas a recibir.`
  );
}

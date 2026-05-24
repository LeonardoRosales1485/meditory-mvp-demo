import { expiryStatus, type Batch, type Medication, type Warehouse, type TransferRequest, type MedicationOrder, type Patient, type Sale, type Dispensation, type Wing, type Room } from "./domain-types";

export interface AssistantWorkspaceSnapshotInput {
  batches: Batch[];
  medications: Medication[];
  warehouses: Warehouse[];
  transfers: TransferRequest[];
  workspaceName: string;
  orders?: MedicationOrder[];
  patients?: Patient[];
  sales?: Sale[];
  dispensations?: Dispensation[];
  wings?: Wing[];
  rooms?: Room[];
  stockConfigs?: { medicationId: string; warehouseId: string; minStock: number; optimalStock: number }[];
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
  limit = 10,
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

function batchesSample(snapshot: AssistantWorkspaceSnapshotInput, limit = 10) {
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

function stockByWarehouse(snapshot: AssistantWorkspaceSnapshotInput): { name: string; value: number }[] {
  const whMap = new Map(snapshot.warehouses.map((w) => [w.id, w]));
  const acc: Record<string, number> = {};
  for (const b of snapshot.batches) {
    const whName = whMap.get(b.warehouseId)?.name ?? b.warehouseId;
    acc[whName] = (acc[whName] ?? 0) + b.quantity;
  }
  return Object.entries(acc)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function expiryDistribution(snapshot: AssistantWorkspaceSnapshotInput): { name: string; value: number }[] {
  const acc: Record<string, number> = { vencido: 0, critico: 0, proximo: 0, ok: 0 };
  for (const b of snapshot.batches) {
    const status = expiryStatus(b.expiry);
    acc[status] = (acc[status] ?? 0) + b.quantity;
  }
  return Object.entries(acc).map(([name, value]) => ({ name, value }));
}

function transferStatusDistribution(snapshot: AssistantWorkspaceSnapshotInput): { name: string; value: number }[] {
  const acc: Record<string, number> = {};
  for (const t of snapshot.transfers) {
    acc[t.status] = (acc[t.status] ?? 0) + t.quantity;
  }
  return Object.entries(acc).map(([name, value]) => ({ name, value }));
}

function wareHouseMap(snapshot: AssistantWorkspaceSnapshotInput) {
  const whMap = new Map(snapshot.warehouses.map((w) => [w.id, w]));
  const result: Record<string, { name: string; type: string; unit: string }> = {};
  for (const [id, w] of whMap) {
    result[id] = { name: w.name, type: w.type, unit: w.unit };
  }
  return result;
}

function pendingOrdersSummary(
  orders: MedicationOrder[],
  medMap: Map<string, Medication>,
): { status: string; count: number; items: { medicationName: string; quantity: number; patient: string }[] }[] {
  const byStatus: Record<string, MedicationOrder[]> = {};
  for (const o of orders) {
    const s = o.status;
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(o);
  }
  return Object.entries(byStatus).map(([status, items]) => ({
    status,
    count: items.length,
    items: items.slice(0, 5).map((o) => ({
      medicationName: medMap.get(o.medicationId)?.name ?? o.medicationId,
      quantity: o.quantity,
      patient: o.patient,
    })),
  }));
}

function lowStockAlerts(
  stockConfigs: { medicationId: string; warehouseId: string; minStock: number; optimalStock: number }[],
  batches: Batch[],
  medMap: Map<string, Medication>,
  whMap: Map<string, Warehouse>,
): { medicationName: string; warehouseName: string; current: number; minStock: number; optimalStock: number }[] {
  const stockByKey: Record<string, number> = {};
  for (const b of batches) {
    const k = `${b.medicationId}::${b.warehouseId}`;
    stockByKey[k] = (stockByKey[k] ?? 0) + b.quantity;
  }
  const alerts: { medicationName: string; warehouseName: string; current: number; minStock: number; optimalStock: number }[] = [];
  for (const cfg of stockConfigs) {
    const k = `${cfg.medicationId}::${cfg.warehouseId}`;
    const current = stockByKey[k] ?? 0;
    if (current < cfg.minStock) {
      alerts.push({
        medicationName: medMap.get(cfg.medicationId)?.name ?? cfg.medicationId,
        warehouseName: whMap.get(cfg.warehouseId)?.name ?? cfg.warehouseId,
        current,
        minStock: cfg.minStock,
        optimalStock: cfg.optimalStock,
      });
    }
  }
  return alerts.sort((a, b) => (a.current / a.minStock) - (b.current / b.minStock)).slice(0, 10);
}

function criticalExpiriesList(
  batches: Batch[],
  medMap: Map<string, Medication>,
  whMap: Map<string, Warehouse>,
): { medicationName: string; warehouseName: string; lot: string; expiry: string; daysLeft: number; quantity: number }[] {
  const now = Date.now();
  return batches
    .filter((b) => {
      const expiry = new Date(b.expiry).getTime();
      return expiry > now && expiry <= now + 30 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())
    .map((b) => ({
      medicationName: medMap.get(b.medicationId)?.name ?? b.medicationId,
      warehouseName: whMap.get(b.warehouseId)?.name ?? b.warehouseId,
      lot: b.lot,
      expiry: b.expiry,
      daysLeft: Math.floor((new Date(b.expiry).getTime() - now) / (1000 * 60 * 60 * 24)),
      quantity: b.quantity,
    }));
}

function patientsSummary(patients: Patient[]): { total: number; byRoom: Record<string, number> } {
  const byRoom: Record<string, number> = {};
  for (const p of patients) {
    byRoom[p.room] = (byRoom[p.room] ?? 0) + 1;
  }
  return { total: patients.length, byRoom };
}

function recentSales(sales: Sale[], medMap: Map<string, Medication>, limit = 5): { medicationName: string; quantity: number; price: number; date: string }[] {
  return sales
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((s) => ({
      medicationName: medMap.get(s.medicationId)?.name ?? s.medicationId,
      quantity: s.quantity,
      price: s.price,
      date: s.date,
    }));
}

function recentDispensations(dispensations: Dispensation[], medMap: Map<string, Medication>, limit = 5): { medicationName: string; quantity: number; patient: string; date: string }[] {
  return dispensations
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((d) => ({
      medicationName: medMap.get(d.medicationId)?.name ?? d.medicationId,
      quantity: d.quantity,
      patient: d.patient,
      date: d.date,
    }));
}

export function buildWorkspaceAssistantContext(
  snapshotInput: AssistantWorkspaceSnapshotInput,
): string {
  const medMap = new Map(snapshotInput.medications.map((m) => [m.id, m]));
  const whMap = new Map(snapshotInput.warehouses.map((w) => [w.id, w]));

  const ctx: Record<string, unknown> = {
    workspaceName: snapshotInput.workspaceName,
    stockByMedicationId: stockByMedicationId(snapshotInput),
    topMedicationsByUnits: topMedicationsByUnits(snapshotInput),
    stockByWarehouse: stockByWarehouse(snapshotInput),
    expiryDistribution: expiryDistribution(snapshotInput),
    transferStatusDistribution: transferStatusDistribution(snapshotInput),
    batchesSample: batchesSample(snapshotInput),
    pendingTransfers: pendingTransfers(snapshotInput),
    summary: summary(snapshotInput),
    warehouses: wareHouseMap(snapshotInput),
    totalBatches: snapshotInput.batches.length,
    totalMedications: snapshotInput.medications.length,
  };

  if (snapshotInput.orders && snapshotInput.orders.length > 0) {
    ctx.pendingOrdersSummary = pendingOrdersSummary(snapshotInput.orders, medMap);
    ctx.totalOrders = snapshotInput.orders.length;
  }

  if (snapshotInput.patients) {
    ctx.patientsSummary = patientsSummary(snapshotInput.patients);
    ctx.patients = snapshotInput.patients.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      room: p.room,
      diagnosis: p.diagnosis,
      doctor: p.assignedDoctor,
    }));
  }

  if (snapshotInput.sales && snapshotInput.sales.length > 0) {
    ctx.recentSales = recentSales(snapshotInput.sales, medMap);
  }

  if (snapshotInput.dispensations && snapshotInput.dispensations.length > 0) {
    ctx.recentDispensations = recentDispensations(snapshotInput.dispensations, medMap);
  }

  if (snapshotInput.wings && snapshotInput.wings.length > 0) {
    ctx.wings = snapshotInput.wings.map((w) => ({ name: w.name, type: w.type }));
  }

  if (snapshotInput.rooms && snapshotInput.rooms.length > 0) {
    ctx.rooms = snapshotInput.rooms.map((r) => ({ number: r.fullNumber, bedCount: r.bedCount }));
  }

  if (snapshotInput.stockConfigs && snapshotInput.stockConfigs.length > 0) {
    ctx.lowStockAlerts = lowStockAlerts(snapshotInput.stockConfigs, snapshotInput.batches, medMap, whMap);
    ctx.criticalExpiries = criticalExpiriesList(snapshotInput.batches, medMap, whMap);
  }

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

import { supabaseAdmin } from "./supabase-admin";
import { randomUUID } from "node:crypto";

const TRANSFER_NEXT = {
  solicitado: "autorizado",
  autorizado: "despachado",
  despachado: "recibir",
  recibir: "recibido",
  recibido: "aceptado",
  aceptado: null,
  rechazado: null,
} as const;

async function db<T>(promise: Promise<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? ([] as unknown as T));
}

type DbWarehouseRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: "central" | "interna" | "ventas";
  deleted_at: string | null;
};

type DbMedicationRow = {
  workspace_id: string;
  deleted_at: string | null;
  sale_enabled: boolean | null;
};

async function getMedicationRow(medicationId: string): Promise<DbMedicationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("medications")
    .select("workspace_id, deleted_at, sale_enabled")
    .eq("id", medicationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DbMedicationRow | null;
}

async function assertMedicationActiveForWorkspace(workspaceId: string, medicationId: string) {
  const med = await getMedicationRow(medicationId);
  if (!med || med.workspace_id !== workspaceId) {
    throw new Error("Medicamento no encontrado en el workspace actual.");
  }
  if (med.deleted_at) {
    throw new Error("El medicamento fue dado de baja del catálogo.");
  }
}

type ActionPayloadMap = {
  addMedication: {
    workspaceId: string;
    actor: string;
    medication: {
      name: string;
      activeIngredient: string;
      concentrationValue: number;
      concentrationUnit: string;
      form: string;
      salePrice?: number;
      saleEnabled?: boolean;
    };
  };
  updateMedication: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{
      name: string;
      activeIngredient: string;
      concentrationValue: number;
      concentrationUnit: string;
      form: string;
      salePrice: number;
      saleEnabled: boolean;
    }>;
  };
  deleteMedication: { workspaceId: string; actor: string; id: string };
  addReceipt: {
    workspaceId: string;
    actor: string;
    medicationId: string;
    warehouseId: string;
    lot: string;
    expiry: string;
    quantity: number;
    reason?: string;
  };
  adjustStock: { workspaceId: string; actor: string; batchId: string; delta: number; reason: string };
  createTransfer: {
    workspaceId: string;
    actor: string;
    medicationId: string;
    sourceBatchId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
  };
  advanceTransfer: { workspaceId: string; actor: string; id: string };
  rejectTransfer: {
    workspaceId: string;
    actor: string;
    id: string;
    reason: string;
    outcome: "devolver" | "descartar";
  };
  addSale: {
    workspaceId: string;
    actor: string;
    medicationId: string;
    warehouseId: string;
    quantity: number;
    price: number;
    prescription?: string;
  };
  addDispensation: {
    workspaceId: string;
    actor: string;
    medicationId: string;
    warehouseId: string;
    quantity: number;
    doctor: string;
    patient: string;
    room: string;
    treatment: string;
  };
  createOrder: {
    workspaceId: string;
    actor: string;
    medicationId: string;
    sourceBatchId: string;
    warehouseId: string;
    quantity: number;
    doctorName?: string;
    patient: string;
    room: string;
    reason: string;
  };
  processOrder: {
    workspaceId: string;
    actor: string;
    actorRole: "admin" | "ventas" | "doctor" | "tecnico";
    id: string;
    action:
      | "aprobar"
      | "despachar"
      | "marcar_recibir"
      | "confirmar_recepcion"
      | "administrar"
      | "devolver_recibido"
      | "descartar_recibido"
      | "solicitar_devolucion"
      | "aprobar_devolucion"
      | "rechazar_devolucion"
      | "rechazar";
    reason?: string;
  };
  addUser: {
    workspaceId: string;
    actor: string;
    user: {
      name: string;
      email: string;
      role: "admin" | "ventas" | "doctor" | "tecnico";
      workspaceId: string;
      warehouseIds: string[];
    };
  };
  updateUser: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{ name: string; email: string; role: "admin" | "ventas" | "doctor" | "tecnico"; warehouseIds: string[] }>;
  };
  deleteUser: { workspaceId: string; actor: string; id: string };
  addWarehouse: {
    workspaceId: string;
    actor: string;
    warehouse: { name: string; type: "central" | "interna" | "ventas" };
  };
  updateWarehouse: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{ name: string; type: "central" | "interna" | "ventas" }>;
  };
  deleteWarehouse: { workspaceId: string; actor: string; id: string };
  resetWorkspace: { workspaceId: string; actor: string };
  addPatient: {
    workspaceId: string;
    actor: string;
    patient: {
      firstName: string;
      lastName: string;
      insurance: string;
      diagnosis: string;
      assignedDoctor: string;
      room: string;
    };
    bedId?: string | null;
  };
  updatePatient: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{
      firstName: string;
      lastName: string;
      insurance: string;
      diagnosis: string;
      assignedDoctor: string;
      room: string;
    }>;
  };
  deletePatient: { workspaceId: string; actor: string; id: string };
  addWing: {
    workspaceId: string;
    actor: string;
    wing: {
      name: string;
      type:
        | "urgencias"
        | "quirofanos"
        | "cuidados_intensivos"
        | "hospitalizacion"
        | "ambulatoria";
      prefix: number;
    };
  };
  updateWing: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{
      name: string;
      type:
        | "urgencias"
        | "quirofanos"
        | "cuidados_intensivos"
        | "hospitalizacion"
        | "ambulatoria";
      prefix: number;
    }>;
  };
  deleteWing: { workspaceId: string; actor: string; id: string };
  addRoom: {
    workspaceId: string;
    actor: string;
    room: { wingId: string; number: number; bedCount: number };
  };
  updateRoom: {
    workspaceId: string;
    actor: string;
    id: string;
    patch: Partial<{ wingId: string; number: number; bedCount: number }>;
  };
  deleteRoom: { workspaceId: string; actor: string; id: string };
  assignBed: {
    workspaceId: string;
    actor: string;
    bedId: string;
    patientId: string | null;
  };
};

async function logAudit(workspaceId: string, actor: string, action: string, entity: string) {
  await db(
    supabaseAdmin.from("audit_log").insert({
      id: randomUUID(),
      workspace_id: workspaceId,
      user_name: actor,
      action,
      entity,
      date: new Date().toISOString(),
    }),
  );
}

async function consumeStock(medicationId: string, warehouseId: string, quantity: number) {
  const { error } = await supabaseAdmin.rpc("consume_stock", {
    p_medication_id: medicationId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
  });
  if (error) throw new Error(error.message);
}

async function consumeBatchStock(batchId: string, quantity: number) {
  const { data: batch, error } = await supabaseAdmin.from("batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!batch) throw new Error("Lote no encontrado.");
  if (Number(batch.quantity) < quantity) {
    throw new Error(`Stock insuficiente en el lote seleccionado (${batch.lot}).`);
  }
  await db(
    supabaseAdmin
      .from("batches")
      .update({ quantity: Number(batch.quantity) - quantity })
      .eq("id", batchId),
  );
  return batch as {
    id: string;
    medication_id: string;
    warehouse_id: string;
    lot: string;
    expiry: string;
    quantity: number;
  };
}

async function getBatchById(batchId: string) {
  const { data, error } = await supabaseAdmin.from("batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as
    | {
        id: string;
        medication_id: string;
        warehouse_id: string;
        lot: string;
        expiry: string;
        quantity: number;
      }
    | null;
}

async function addStockToLot(
  medicationId: string,
  warehouseId: string,
  lot: string,
  expiry: string,
  quantity: number,
) {
  const { data: existing, error } = await supabaseAdmin
    .from("batches")
    .select("id, quantity")
    .eq("medication_id", medicationId)
    .eq("warehouse_id", warehouseId)
    .eq("lot", lot)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) {
    await db(
      supabaseAdmin
        .from("batches")
        .update({ quantity: Number(existing.quantity) + quantity })
        .eq("id", existing.id),
    );
    return;
  }
  await db(
    supabaseAdmin.from("batches").insert({
      id: randomUUID(),
      medication_id: medicationId,
      warehouse_id: warehouseId,
      lot,
      expiry,
      quantity,
    }),
  );
}

async function transferDetail(transfer: {
  id: string;
  transfer_code?: string | null;
  medication_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: number;
}) {
  const [{ data: med }, { data: fromWh }, { data: toWh }] = await Promise.all([
    supabaseAdmin.from("medications").select("name, concentration_value, concentration_unit").eq("id", transfer.medication_id).maybeSingle(),
    supabaseAdmin.from("warehouses").select("name").eq("id", transfer.from_warehouse_id).maybeSingle(),
    supabaseAdmin.from("warehouses").select("name").eq("id", transfer.to_warehouse_id).maybeSingle(),
  ]);
  const medLabel = med ? `${med.name} ${med.concentration_value}${med.concentration_unit}` : `medicación ${transfer.medication_id}`;
  const fromLabel = fromWh?.name ?? transfer.from_warehouse_id;
  const toLabel = toWh?.name ?? transfer.to_warehouse_id;
  const displayCode = transfer.transfer_code ?? transfer.id;
  return `Transferencia #${displayCode} · ${medLabel} · ${fromLabel} -> ${toLabel} · ${transfer.quantity}u · Ref: ${transfer.id}`;
}

async function nextTransferCode(workspaceId: string) {
  const { data, error } = await supabaseAdmin.rpc("next_transfer_code", {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

async function medicationDetailById(medicationId: string) {
  const { data: med } = await supabaseAdmin
    .from("medications")
    .select("name, concentration_value, concentration_unit, form")
    .eq("id", medicationId)
    .maybeSingle();
  if (!med) return `Medicamento (${medicationId})`;
  return `${med.name} ${med.concentration_value}${med.concentration_unit} · ${med.form}`;
}

async function userDetailById(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("workspace_users")
    .select("name, role, email")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return `Usuario (${userId})`;
  const roleLabel =
    user.role === "tecnico"
      ? "Enfermero Jefe"
      : user.role === "admin"
        ? "Admin"
        : user.role === "ventas"
          ? "Ventas"
          : "Doctor";
  return `${user.name} (${roleLabel}) · ${user.email}`;
}

async function warehouseDetailById(warehouseId: string) {
  const { data: warehouse } = await supabaseAdmin
    .from("warehouses")
    .select("name, type")
    .eq("id", warehouseId)
    .maybeSingle();
  if (!warehouse) return `Depósito (${warehouseId})`;
  return `${warehouse.name} (${warehouse.type})`;
}

async function getWarehouseById(warehouseId: string): Promise<DbWarehouseRow | null> {
  const { data, error } = await supabaseAdmin
    .from("warehouses")
    .select("id, workspace_id, name, type, deleted_at")
    .eq("id", warehouseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DbWarehouseRow | null;
}

const SYSTEM_ACTOR_NAME = "Asistente Medi";
const SYSTEM_ACTOR = { id: "system", role: "admin" as const, name: SYSTEM_ACTOR_NAME, email: "" };

function isSystemActor(actor: string): boolean {
  return actor === SYSTEM_ACTOR_NAME;
}

async function resolveActorUser(workspaceId: string, actor: string) {
  if (!actor) throw new Error("No se pudo validar el usuario actor en este workspace.");
  // Backoffice / system actor — treat as admin with no workspace_users row
  if (isSystemActor(actor)) return SYSTEM_ACTOR;
  // Try by email first (sessions store email as actor identifier)
  if (actor.includes("@")) {
    const { data: byEmail, error: emailError } = await supabaseAdmin
      .from("workspace_users")
      .select("id, role, name, email")
      .eq("workspace_id", workspaceId)
      .eq("email", actor)
      .maybeSingle();
    if (emailError) throw new Error(emailError.message);
    if (byEmail) return byEmail as { id: string; role: string; name: string; email: string };
  }
  // Fallback: try by display name (legacy sessions or edge cases)
  const { data: byName, error: nameError } = await supabaseAdmin
    .from("workspace_users")
    .select("id, role, name, email")
    .eq("workspace_id", workspaceId)
    .eq("name", actor)
    .maybeSingle();
  if (nameError) throw new Error(nameError.message);
  if (!byName) throw new Error("No se pudo validar el usuario actor en este workspace.");
  return byName as { id: string; role: string; name: string; email: string };
}

async function assertWarehouseAccess(workspaceId: string, actor: string, warehouseId: string) {
  const wh = await getWarehouseById(warehouseId);
  if (!wh || wh.workspace_id !== workspaceId) {
    throw new Error("No tenés acceso al depósito requerido para esta operación.");
  }
  if (wh.deleted_at) {
    throw new Error("El depósito fue dado de baja.");
  }
  // System actor (backoffice) has full warehouse access
  if (isSystemActor(actor)) return;
  const actorUser = await resolveActorUser(workspaceId, actor);
  const { data, error } = await supabaseAdmin
    .from("workspace_user_warehouses")
    .select("warehouse_id")
    .eq("user_id", actorUser.id)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No tenés acceso al depósito requerido para esta operación.");
}

async function assertAssignableWarehouses(workspaceId: string, warehouseIds: string[]) {
  if (warehouseIds.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from("warehouses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", warehouseIds)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r) => (r as { id: string }).id));
  for (const id of warehouseIds) {
    if (!found.has(id)) {
      throw new Error("Uno o más depósitos asignados no existen o fueron dados de baja.");
    }
  }
}

export async function fetchWorkspaceData(workspaceId: string) {
  const whRows = await db<object[]>(
    supabaseAdmin.from("warehouses").select("*").eq("workspace_id", workspaceId),
  );
  const warehouseIds = (whRows ?? []).map((w) => w.id) as string[];

  const fetchByWH = (table: string, col: string) =>
    warehouseIds.length
      ? db<object[]>(supabaseAdmin.from(table).select("*").in(col, warehouseIds))
      : Promise.resolve([] as object[]);
  const [medRows, batchRows, movRows, txFromRows, txToRows, saleRows, dispRows, orderRows, userRows, patientRows, auditRows] =
    await Promise.all([
      db<object[]>(supabaseAdmin.from("medications").select("*").eq("workspace_id", workspaceId)),
      fetchByWH("batches", "warehouse_id"),
      db<object[]>(supabaseAdmin.from("movements").select("*").eq("workspace_id", workspaceId).order("date", { ascending: false }).limit(200)),
      warehouseIds.length
        ? db<object[]>(supabaseAdmin.from("transfer_requests").select("*").in("from_warehouse_id", warehouseIds))
        : Promise.resolve([] as object[]),
      warehouseIds.length
        ? db<object[]>(supabaseAdmin.from("transfer_requests").select("*").in("to_warehouse_id", warehouseIds))
        : Promise.resolve([] as object[]),
      db<object[]>(supabaseAdmin.from("sales").select("*").eq("workspace_id", workspaceId).order("date", { ascending: false }).limit(100)),
      db<object[]>(supabaseAdmin.from("dispensations").select("*").eq("workspace_id", workspaceId).order("date", { ascending: false }).limit(100)),
      warehouseIds.length
        ? db<object[]>(supabaseAdmin.from("medication_orders").select("*").in("warehouse_id", warehouseIds).order("requested_at", { ascending: false }))
        : Promise.resolve([] as object[]),
      db<object[]>(supabaseAdmin.from("workspace_users").select("*").eq("workspace_id", workspaceId)),
      db<object[]>(supabaseAdmin.from("patients").select("*").eq("workspace_id", workspaceId).order("last_name", { ascending: true })),
      db<object[]>(supabaseAdmin.from("audit_log").select("*").eq("workspace_id", workspaceId).order("date", { ascending: false }).limit(200)),
    ]);
  const userIds = (userRows ?? []).map((u) => (u as { id: string }).id);
  const userWarehouseAccessRows = userIds.length
    ? await db<object[]>(supabaseAdmin.from("workspace_user_warehouses").select("*").in("user_id", userIds))
    : [];

  const [wingRows, roomRows] = await Promise.all([
    db<object[]>(supabaseAdmin.from("wings").select("*").eq("workspace_id", workspaceId).order("prefix", { ascending: true })),
    db<object[]>(supabaseAdmin.from("rooms").select("*").eq("workspace_id", workspaceId).order("full_number", { ascending: true })),
  ]);
  const roomIds = (roomRows ?? []).map((r) => (r as { id: string }).id);
  const bedRows = roomIds.length
    ? await db<object[]>(supabaseAdmin.from("beds").select("*").in("room_id", roomIds).order("position", { ascending: true }))
    : [];

  const txMap = new Map<string, object>();
  [...(txFromRows ?? []), ...(txToRows ?? [])].forEach((r) => txMap.set((r as { id: string }).id, r));

  return {
    warehouses: whRows ?? [],
    medications: medRows ?? [],
    batches: batchRows ?? [],
    movements: movRows ?? [],
    transfers: [...txMap.values()],
    sales: saleRows ?? [],
    dispensations: dispRows ?? [],
    orders: orderRows ?? [],
    users: userRows ?? [],
    patients: patientRows ?? [],
    userWarehouseAccesses: userWarehouseAccessRows ?? [],
    audit: auditRows ?? [],
    wings: wingRows ?? [],
    rooms: roomRows ?? [],
    beds: bedRows ?? [],
  };
}

export async function runAction<K extends keyof ActionPayloadMap>(action: K, payload: ActionPayloadMap[K]) {
  if (action === "addMedication") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    await db(
      supabaseAdmin.from("medications").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        name: payload.medication.name,
        active_ingredient: payload.medication.activeIngredient,
        concentration_value: payload.medication.concentrationValue,
        concentration_unit: payload.medication.concentrationUnit,
        form: payload.medication.form,
        sale_price: Math.max(0, Number(payload.medication.salePrice ?? 0)),
        sale_enabled: payload.medication.saleEnabled !== false,
      }),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Alta de medicamento", payload.medication.name);
    return;
  }

  if (action === "updateMedication") {
    const medRow = await getMedicationRow(payload.id);
    if (!medRow || medRow.workspace_id !== payload.workspaceId) {
      throw new Error("Medicamento no encontrado en el workspace actual.");
    }
    if (medRow.deleted_at) {
      throw new Error("No se puede editar un medicamento dado de baja del catálogo.");
    }
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) dbPatch.name = payload.patch.name;
    if (payload.patch.activeIngredient !== undefined) dbPatch.active_ingredient = payload.patch.activeIngredient;
    if (payload.patch.concentrationValue !== undefined) dbPatch.concentration_value = payload.patch.concentrationValue;
    if (payload.patch.concentrationUnit !== undefined) dbPatch.concentration_unit = payload.patch.concentrationUnit;
    if (payload.patch.form !== undefined) dbPatch.form = payload.patch.form;
    if (payload.patch.salePrice !== undefined) {
      if (actorUser.role !== "admin") {
        throw new Error("Solo administración puede actualizar precios de venta del catálogo.");
      }
      const sp = Number(payload.patch.salePrice);
      if (Number.isNaN(sp) || sp < 0) throw new Error("Precio de venta inválido.");
      dbPatch.sale_price = sp;
    }
    if (payload.patch.saleEnabled !== undefined) {
      if (actorUser.role !== "admin") {
        throw new Error("Solo administración puede habilitar o deshabilitar la venta en mostrador.");
      }
      dbPatch.sale_enabled = Boolean(payload.patch.saleEnabled);
    }
    await db(supabaseAdmin.from("medications").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Editó medicamento", await medicationDetailById(payload.id));
    return;
  }

  if (action === "deleteMedication") {
    const { data: med, error: medErr } = await supabaseAdmin
      .from("medications")
      .select("id, workspace_id, deleted_at")
      .eq("id", payload.id)
      .maybeSingle();
    if (medErr) throw new Error(medErr.message);
    if (!med || (med as { workspace_id: string }).workspace_id !== payload.workspaceId) {
      throw new Error("Medicamento no encontrado en el workspace actual.");
    }
    if ((med as { deleted_at: string | null }).deleted_at) {
      throw new Error("Este medicamento ya fue dado de baja del catálogo.");
    }
    const { data: batchRows, error: batchErr } = await supabaseAdmin
      .from("batches")
      .select("quantity")
      .eq("medication_id", payload.id);
    if (batchErr) throw new Error(batchErr.message);
    const stockTotal = (batchRows ?? []).reduce(
      (s, r) => s + Number((r as { quantity: number }).quantity ?? 0),
      0,
    );
    if (stockTotal > 0) {
      throw new Error(
        "No se puede dar de baja el medicamento: aún hay stock en depósitos (suma de lotes distinta de cero). Transferí, dispensá, vendé o ajustá hasta dejar saldo cero.",
      );
    }
    const transferTerminal = new Set(["aceptado", "rechazado"]);
    const { data: trRows, error: trErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, status")
      .eq("workspace_id", payload.workspaceId)
      .eq("medication_id", payload.id);
    if (trErr) throw new Error(trErr.message);
    const activeTransfers = (trRows ?? []).filter((t) => !transferTerminal.has((t as { status: string }).status));
    if (activeTransfers.length > 0) {
      throw new Error(
        "No se puede dar de baja el medicamento: hay transferencias de stock activas que lo involucran. Finalizalas o cancelalas antes.",
      );
    }
    const orderTerminal = new Set(["administrado", "rechazado", "devuelto", "devolucion_rechazada"]);
    const { data: ordRows, error: ordErr } = await supabaseAdmin
      .from("medication_orders")
      .select("id, status")
      .eq("workspace_id", payload.workspaceId)
      .eq("medication_id", payload.id);
    if (ordErr) throw new Error(ordErr.message);
    const activeOrders = (ordRows ?? []).filter((o) => !orderTerminal.has((o as { status: string }).status));
    if (activeOrders.length > 0) {
      throw new Error(
        "No se puede dar de baja el medicamento: hay pedidos médicos en curso que lo referencian. Completá o rechazá esos pedidos antes.",
      );
    }
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const detail = await medicationDetailById(payload.id);
    await db(
      supabaseAdmin.from("medications").update({ deleted_at: new Date().toISOString() }).eq("id", payload.id),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Baja de medicamento (catálogo)", detail);
    return;
  }

  if (action === "addReceipt") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const warehouse = await getWarehouseById(payload.warehouseId);
    if (!warehouse || warehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito inválido para el workspace actual.");
    }
    if (warehouse.type !== "central") {
      throw new Error("Los ingresos solo pueden registrarse en el depósito central.");
    }
    if (warehouse.deleted_at) {
      throw new Error("El depósito central fue dado de baja.");
    }
    await assertMedicationActiveForWorkspace(payload.workspaceId, payload.medicationId);
    const expiryDate = new Date(payload.expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= today) {
      throw new Error("El vencimiento debe ser una fecha futura.");
    }

    const insertedBatch = await db<{ id: string }>(
      supabaseAdmin
        .from("batches")
        .insert({
          id: randomUUID(),
          medication_id: payload.medicationId,
          warehouse_id: payload.warehouseId,
          lot: payload.lot,
          expiry: payload.expiry.split("T")[0],
          quantity: payload.quantity,
        })
        .select("id")
        .single(),
    );
    try {
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "ingreso",
          medication_id: payload.medicationId,
          warehouse_id: payload.warehouseId,
          quantity: payload.quantity,
          lot: payload.lot,
          user_name: actorUser.name,
          reason: payload.reason ?? `Ingreso lote ${payload.lot}`,
          date: new Date().toISOString(),
        }),
      );
    } catch (error) {
      await db(supabaseAdmin.from("batches").delete().eq("id", insertedBatch.id));
      throw error;
    }
    await logAudit(payload.workspaceId, actorUser.name, "Ingreso de mercadería", `Lote ${payload.lot}`);
    return;
  }

  if (action === "adjustStock") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const { data: batch, error: batchError } = await supabaseAdmin.from("batches").select("*").eq("id", payload.batchId).maybeSingle();
    if (batchError) throw new Error(batchError.message);
    if (!batch) throw new Error("Lote no encontrado");
    const batchWh = await getWarehouseById(String(batch.warehouse_id));
    if (!batchWh || batchWh.deleted_at) {
      throw new Error("No se puede ajustar stock en un depósito dado de baja.");
    }
    const newQty = Math.max(0, Number(batch.quantity) + payload.delta);
    await db(supabaseAdmin.from("batches").update({ quantity: newQty }).eq("id", payload.batchId));
    await db(
      supabaseAdmin.from("movements").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        type: "ajuste",
        medication_id: batch.medication_id,
        warehouse_id: batch.warehouse_id,
        quantity: payload.delta,
        lot: batch.lot,
        user_name: actorUser.name,
        reason: `Ajuste lote ${batch.lot}: ${payload.reason}`,
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Ajuste de stock", `${batch.lot} (${payload.delta})`);
    return;
  }

  if (action === "createTransfer") {
    const fromWarehouse = await getWarehouseById(payload.fromWarehouseId);
    const toWarehouse = await getWarehouseById(payload.toWarehouseId);
    if (
      !fromWarehouse ||
      !toWarehouse ||
      fromWarehouse.workspace_id !== payload.workspaceId ||
      toWarehouse.workspace_id !== payload.workspaceId
    ) {
      throw new Error("Los depósitos de la transferencia no pertenecen al workspace actual.");
    }
    if (fromWarehouse.deleted_at || toWarehouse.deleted_at) {
      throw new Error("No se pueden usar depósitos dados de baja en transferencias.");
    }
    if (fromWarehouse.type !== "central") {
      throw new Error("Las transferencias deben originarse en el depósito central.");
    }
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      throw new Error("Origen y destino deben ser distintos.");
    }
    await assertMedicationActiveForWorkspace(payload.workspaceId, payload.medicationId);
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (fromWarehouse.type !== "central") {
      if (actorUser.role !== "admin") {
        throw new Error("Las transferencias deben originarse en el depósito central.");
      }
    }
    let sourceBatchId: string;
    if (payload.sourceBatchId) {
      const sourceBatch = await getBatchById(payload.sourceBatchId);
      if (!sourceBatch) throw new Error("Lote origen no encontrado.");
      if (sourceBatch.medication_id !== payload.medicationId || sourceBatch.warehouse_id !== payload.fromWarehouseId) {
        throw new Error("El lote seleccionado no corresponde al medicamento/depósito origen.");
      }
      if (Number(sourceBatch.quantity) < payload.quantity) {
        throw new Error("El lote seleccionado no tiene stock suficiente.");
      }
      sourceBatchId = payload.sourceBatchId;
    } else {
      const batches = await db<{ id: string; quantity: number }[]>(
        supabaseAdmin.from("batches")
          .select("id, quantity")
          .eq("medication_id", payload.medicationId)
          .eq("warehouse_id", payload.fromWarehouseId)
          .order("expiry", { ascending: true })
      );
      const suitable = batches.find((b) => Number(b.quantity) >= payload.quantity);
      if (!suitable) throw new Error("No hay lote con stock suficiente en el depósito origen");
      sourceBatchId = suitable.id;
    }

    const transferId = randomUUID();
    const transferCode = await nextTransferCode(payload.workspaceId);
    await db(
      supabaseAdmin.from("transfer_requests").insert({
        id: transferId,
        workspace_id: payload.workspaceId,
        transfer_code: transferCode,
        medication_id: payload.medicationId,
        source_batch_id: sourceBatchId,
        from_warehouse_id: payload.fromWarehouseId,
        to_warehouse_id: payload.toWarehouseId,
        quantity: payload.quantity,
        status: "solicitado",
        requested_by: actorUser.name,
        date: new Date().toISOString(),
      }),
    );
    const detail = await transferDetail({
      id: transferId,
      transfer_code: transferCode,
      medication_id: payload.medicationId,
      from_warehouse_id: payload.fromWarehouseId,
      to_warehouse_id: payload.toWarehouseId,
      quantity: payload.quantity,
    });
    await logAudit(payload.workspaceId, actorUser.name, "Transferencia solicitada", detail);
    return;
  }

  if (action === "advanceTransfer") {
    const { data: transfer, error: transferError } = await supabaseAdmin.from("transfer_requests").select("*").eq("id", payload.id).maybeSingle();
    if (transferError) throw new Error(transferError.message);
    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.workspace_id !== payload.workspaceId) {
      throw new Error("La transferencia no pertenece al workspace actual.");
    }
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if ((transfer.status === "solicitado" || transfer.status === "autorizado") && actorUser.role !== "admin") {
      await assertWarehouseAccess(payload.workspaceId, payload.actor, transfer.from_warehouse_id);
    }
    const next = TRANSFER_NEXT[transfer.status as keyof typeof TRANSFER_NEXT];
    if (!next) return;
    if (next === "recibido") {
      await assertWarehouseAccess(payload.workspaceId, payload.actor, transfer.to_warehouse_id);
    }
    if (next === "aceptado") {
      await assertWarehouseAccess(payload.workspaceId, payload.actor, transfer.to_warehouse_id);
    }
    await db(supabaseAdmin.from("transfer_requests").update({ status: next }).eq("id", payload.id));
    if (next === "despachado") {
      let consumedLot: string | null = null;
      if (transfer.source_batch_id) {
        const consumedBatch = await consumeBatchStock(transfer.source_batch_id, transfer.quantity);
        consumedLot = consumedBatch.lot;
      } else {
        await consumeStock(transfer.medication_id, transfer.from_warehouse_id, transfer.quantity);
      }
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "transferencia",
          medication_id: transfer.medication_id,
          warehouse_id: transfer.from_warehouse_id,
          quantity: -transfer.quantity,
          lot: consumedLot,
          user_name: actorUser.name,
          reason: `Despacho a ${transfer.to_warehouse_id} (${transfer.id})`,
          date: new Date().toISOString(),
        }),
      );
    }
    if (next === "aceptado") {
      let receivedLot = `T-${String(transfer.id).slice(0, 8)}`;
      let receivedExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (transfer.source_batch_id) {
        const sourceBatch = await getBatchById(transfer.source_batch_id);
        if (sourceBatch) {
          receivedLot = sourceBatch.lot;
          receivedExpiry = sourceBatch.expiry;
        }
      }
      await addStockToLot(
        transfer.medication_id,
        transfer.to_warehouse_id,
        receivedLot,
        receivedExpiry,
        transfer.quantity,
      );
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "transferencia",
          medication_id: transfer.medication_id,
          warehouse_id: transfer.to_warehouse_id,
          quantity: transfer.quantity,
          lot: receivedLot,
          user_name: actorUser.name,
          reason: `Recepción (${transfer.id})`,
          date: new Date().toISOString(),
        }),
      );
    }
    const detail = await transferDetail({
      id: transfer.id,
      transfer_code: transfer.transfer_code ?? null,
      medication_id: transfer.medication_id,
      from_warehouse_id: transfer.from_warehouse_id,
      to_warehouse_id: transfer.to_warehouse_id,
      quantity: transfer.quantity,
    });
    await logAudit(payload.workspaceId, actorUser.name, `Transferencia ${next}`, detail);
    return;
  }

  if (action === "rejectTransfer") {
    const { data: transfer, error: transferError } = await supabaseAdmin.from("transfer_requests").select("*").eq("id", payload.id).maybeSingle();
    if (transferError) throw new Error(transferError.message);
    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.workspace_id !== payload.workspaceId) {
      throw new Error("La transferencia no pertenece al workspace actual.");
    }
    if (transfer.status !== "recibido") {
      throw new Error("Solo se puede rechazar una transferencia en etapa de revisión post-recepción.");
    }
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    await assertWarehouseAccess(payload.workspaceId, payload.actor, transfer.to_warehouse_id);
    await db(supabaseAdmin.from("transfer_requests").update({ status: "rechazado" }).eq("id", payload.id));
    if (payload.outcome === "devolver") {
      let returnLot = `TR-RET-${String(transfer.id).slice(0, 8)}`;
      let returnExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (transfer.source_batch_id) {
        const sourceBatch = await getBatchById(transfer.source_batch_id);
        if (sourceBatch) {
          returnLot = sourceBatch.lot;
          returnExpiry = sourceBatch.expiry;
        }
      }
      await addStockToLot(
        transfer.medication_id,
        transfer.from_warehouse_id,
        returnLot,
        returnExpiry,
        transfer.quantity,
      );
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "ajuste",
          medication_id: transfer.medication_id,
          warehouse_id: transfer.from_warehouse_id,
          quantity: transfer.quantity,
          lot: returnLot,
          user_name: actorUser.name,
          reason: `Devolución a central por rechazo (${transfer.id})`,
          date: new Date().toISOString(),
        }),
      );
    }
    const detail = await transferDetail({
      id: transfer.id,
      transfer_code: transfer.transfer_code ?? null,
      medication_id: transfer.medication_id,
      from_warehouse_id: transfer.from_warehouse_id,
      to_warehouse_id: transfer.to_warehouse_id,
      quantity: transfer.quantity,
    });
    await logAudit(
      payload.workspaceId,
      actorUser.name,
      "Transferencia rechazada",
      `${detail} · Resolución: ${payload.outcome} · Motivo: ${payload.reason}`,
    );
    return;
  }

  if (action === "addSale") {
    const saleWarehouse = await getWarehouseById(payload.warehouseId);
    if (!saleWarehouse || saleWarehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito inválido para el workspace actual.");
    }
    if (saleWarehouse.type !== "ventas") {
      throw new Error("Las ventas solo pueden registrarse desde un depósito tipo ventas.");
    }
    if (saleWarehouse.deleted_at) {
      throw new Error("El depósito de ventas fue dado de baja.");
    }
    const actorForSale = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorForSale.role !== "admin" && actorForSale.role !== "ventas") {
      throw new Error("Solo administración o ventas pueden registrar ventas en mostrador.");
    }
    await assertWarehouseAccess(payload.workspaceId, payload.actor, payload.warehouseId);
    const medForSale = await getMedicationRow(payload.medicationId);
    if (!medForSale || medForSale.workspace_id !== payload.workspaceId) {
      throw new Error("Medicamento no encontrado en el workspace actual.");
    }
    if (medForSale.deleted_at) {
      throw new Error("El medicamento fue dado de baja del catálogo.");
    }
    if (medForSale.sale_enabled === false) {
      throw new Error(
        "Este medicamento no está habilitado para venta en mostrador. Un administrador puede activarlo en Listas de precios.",
      );
    }
    await consumeStock(payload.medicationId, payload.warehouseId, payload.quantity);
    await db(
      supabaseAdmin.from("sales").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        medication_id: payload.medicationId,
        warehouse_id: payload.warehouseId,
        quantity: payload.quantity,
        price: payload.price,
        prescription: payload.prescription ?? null,
        cashier: actorForSale.name,
        date: new Date().toISOString(),
      }),
    );
    await db(
      supabaseAdmin.from("movements").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        type: "venta",
        medication_id: payload.medicationId,
        warehouse_id: payload.warehouseId,
        quantity: -payload.quantity,
        user_name: actorForSale.name,
        reason: "Venta registrada",
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, actorForSale.name, "Venta registrada", await medicationDetailById(payload.medicationId));
    return;
  }

  if (action === "addDispensation") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const dispWh = await getWarehouseById(payload.warehouseId);
    if (!dispWh || dispWh.workspace_id !== payload.workspaceId || dispWh.deleted_at) {
      throw new Error("Depósito inválido para el workspace actual o dado de baja.");
    }
    await assertMedicationActiveForWorkspace(payload.workspaceId, payload.medicationId);
    await consumeStock(payload.medicationId, payload.warehouseId, payload.quantity);
    await db(
      supabaseAdmin.from("dispensations").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        medication_id: payload.medicationId,
        warehouse_id: payload.warehouseId,
        quantity: payload.quantity,
        doctor: payload.doctor,
        patient: payload.patient,
        room: payload.room,
        treatment: payload.treatment,
        date: new Date().toISOString(),
      }),
    );
    await db(
      supabaseAdmin.from("movements").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        type: "dispensacion",
        medication_id: payload.medicationId,
        warehouse_id: payload.warehouseId,
        quantity: -payload.quantity,
        user_name: actorUser.name,
        reason: `${payload.room} · ${payload.doctor} · ${payload.patient}`,
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Dispensación interna", `${payload.patient} (${payload.room})`);
    return;
  }

  if (action === "createOrder") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role === "tecnico") {
      throw new Error("El enfermero jefe no puede registrar pedidos médicos.");
    }
    const sourceBatch = await getBatchById(payload.sourceBatchId);
    if (!sourceBatch) throw new Error("Lote seleccionado no encontrado.");
    if (sourceBatch.medication_id !== payload.medicationId || sourceBatch.warehouse_id !== payload.warehouseId) {
      throw new Error("El lote seleccionado no corresponde al medicamento/deposito del pedido.");
    }
    if (Number(sourceBatch.quantity) < payload.quantity) {
      throw new Error("El lote seleccionado no tiene stock suficiente.");
    }
    const orderWarehouse = await getWarehouseById(payload.warehouseId);
    if (!orderWarehouse || orderWarehouse.workspace_id !== payload.workspaceId || orderWarehouse.deleted_at) {
      throw new Error("El depósito del pedido no es válido o fue dado de baja.");
    }
    await assertMedicationActiveForWorkspace(payload.workspaceId, payload.medicationId);
    const requestedDoctor = payload.doctorName?.trim() || actorUser.name;
    await db(
      supabaseAdmin.from("medication_orders").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        medication_id: payload.medicationId,
        source_batch_id: payload.sourceBatchId,
        warehouse_id: payload.warehouseId,
        quantity: payload.quantity,
        doctor: requestedDoctor,
        patient: payload.patient,
        room: payload.room,
        reason: payload.reason,
        status: "pendiente",
        requested_at: new Date().toISOString(),
      }),
    );
    await logAudit(
      payload.workspaceId,
      actorUser.name,
      "Pedido de medicación",
      `${payload.patient} (${payload.room}) · Médico: ${requestedDoctor}${requestedDoctor !== actorUser.name ? ` · Cargado por: ${actorUser.name}` : ""}`,
    );
    return;
  }

  if (action === "processOrder") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const { data: order, error: orderError } = await supabaseAdmin.from("medication_orders").select("*").eq("id", payload.id).maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Pedido no encontrado");
    if (payload.actorRole === "tecnico") {
      const allowed: ActionPayloadMap["processOrder"]["action"][] = ["despachar", "marcar_recibir", "confirmar_recepcion"];
      if (!allowed.includes(payload.action)) {
        throw new Error(
          "El enfermero jefe solo puede despachar o avanzar la recepción del pedido en depósitos asignados; no puede administrar ni rechazar.",
        );
      }
      // En el esquema actual un solo warehouse_id cubre el depósito que gestiona el pedido (origen del despacho y trazabilidad de recepción).
      await assertWarehouseAccess(payload.workspaceId, payload.actor, order.warehouse_id);
    } else if (
      payload.action === "confirmar_recepcion" &&
      payload.actorRole !== "admin" &&
      actorUser.name !== order.doctor
    ) {
      throw new Error("Solo el médico solicitante o un admin puede aceptar la entrega.");
    }
    if (
      payload.action === "aprobar_devolucion" ||
      payload.action === "rechazar_devolucion" ||
      payload.action === "devolver_recibido"
    ) {
      await assertWarehouseAccess(payload.workspaceId, payload.actor, order.warehouse_id);
    }
    const transitionMap: Record<ActionPayloadMap["processOrder"]["action"], string> = {
      aprobar: "aprobado",
      despachar: "despachado",
      marcar_recibir: "recibir",
      confirmar_recepcion: "recibido",
      administrar: "administrado",
      devolver_recibido: "devuelto",
      descartar_recibido: "administrado",
      solicitar_devolucion: "devolucion_solicitada",
      aprobar_devolucion: "devuelto",
      rechazar_devolucion: "devolucion_rechazada",
      rechazar: "rechazado",
    };
    const next = transitionMap[payload.action];
    await db(
      supabaseAdmin
        .from("medication_orders")
        .update({ status: next, processed_at: new Date().toISOString(), processed_by: actorUser.name })
        .eq("id", payload.id),
    );
    if (payload.action === "despachar") {
      let consumedLot: string | null = null;
      if (order.source_batch_id) {
        const consumedBatch = await consumeBatchStock(order.source_batch_id, order.quantity);
        consumedLot = consumedBatch.lot;
      } else {
        await consumeStock(order.medication_id, order.warehouse_id, order.quantity);
      }
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "dispensacion",
          medication_id: order.medication_id,
          warehouse_id: order.warehouse_id,
          quantity: -order.quantity,
          lot: consumedLot,
          user_name: actorUser.name,
          reason: `Pedido ${order.id} — ${order.room}`,
          date: new Date().toISOString(),
        }),
      );
    }
    if (payload.action === "aprobar_devolucion") {
      let returnLot = `DEV-${String(order.id).slice(0, 8)}`;
      let returnExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (order.source_batch_id) {
        const sourceBatch = await getBatchById(order.source_batch_id);
        if (sourceBatch) {
          returnLot = sourceBatch.lot;
          returnExpiry = sourceBatch.expiry;
        }
      }
      await addStockToLot(
        order.medication_id,
        order.warehouse_id,
        returnLot,
        returnExpiry,
        order.quantity,
      );
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "ajuste",
          medication_id: order.medication_id,
          warehouse_id: order.warehouse_id,
          quantity: order.quantity,
          lot: returnLot,
          user_name: actorUser.name,
          reason: `Devolución aprobada pedido ${order.id}`,
          date: new Date().toISOString(),
        }),
      );
    }
    if (payload.action === "devolver_recibido") {
      let returnLot = `DEVREC-${String(order.id).slice(0, 8)}`;
      let returnExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (order.source_batch_id) {
        const sourceBatch = await getBatchById(order.source_batch_id);
        if (sourceBatch) {
          returnLot = sourceBatch.lot;
          returnExpiry = sourceBatch.expiry;
        }
      }
      await addStockToLot(
        order.medication_id,
        order.warehouse_id,
        returnLot,
        returnExpiry,
        order.quantity,
      );
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "ajuste",
          medication_id: order.medication_id,
          warehouse_id: order.warehouse_id,
          quantity: order.quantity,
          lot: returnLot,
          user_name: actorUser.name,
          reason: `Devolución desde pedido recibido ${order.id}`,
          date: new Date().toISOString(),
        }),
      );
    }
    if (payload.action === "rechazar_devolucion") {
      await consumeStock(order.medication_id, order.warehouse_id, 1);
      await db(
        supabaseAdmin.from("movements").insert({
          id: randomUUID(),
          workspace_id: payload.workspaceId,
          type: "ajuste",
          medication_id: order.medication_id,
          warehouse_id: order.warehouse_id,
          quantity: -1,
          user_name: actorUser.name,
          reason: `Devolución rechazada pedido ${order.id}: ${payload.reason ?? "Sin motivo"}`,
          date: new Date().toISOString(),
        }),
      );
    }
    await logAudit(
      payload.workspaceId,
      actorUser.name,
      `Pedido ${payload.action}`,
      `Pedido #${order.id} · ${order.quantity}u · Paciente ${order.patient} · Habitación ${order.room}${payload.reason ? ` · Motivo: ${payload.reason}` : ""}`,
    );
    return;
  }

  if (action === "addUser") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const createdUser = await db<{ id: string }>(
      supabaseAdmin.from("workspace_users").insert({
        id: randomUUID(),
        workspace_id: payload.user.workspaceId,
        name: payload.user.name,
        email: payload.user.email.toLowerCase(),
        role: payload.user.role,
      }).select("id").single(),
    );
    if (payload.user.warehouseIds.length > 0) {
      await assertAssignableWarehouses(payload.workspaceId, payload.user.warehouseIds);
      await db(
        supabaseAdmin.from("workspace_user_warehouses").insert(
          payload.user.warehouseIds.map((warehouseId) => ({
            user_id: createdUser.id,
            warehouse_id: warehouseId,
          })),
        ),
      );
    }
    await logAudit(payload.workspaceId, actorUser.name, "Alta de usuario", `${payload.user.name} (${payload.user.role})`);
    return;
  }

  if (action === "updateUser") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) dbPatch.name = payload.patch.name;
    if (payload.patch.email !== undefined) dbPatch.email = payload.patch.email.toLowerCase();
    if (payload.patch.role !== undefined) dbPatch.role = payload.patch.role;
    await db(supabaseAdmin.from("workspace_users").update(dbPatch).eq("id", payload.id));
    if (payload.patch.warehouseIds !== undefined) {
      await db(supabaseAdmin.from("workspace_user_warehouses").delete().eq("user_id", payload.id));
      if (payload.patch.warehouseIds.length > 0) {
        await assertAssignableWarehouses(payload.workspaceId, payload.patch.warehouseIds);
        await db(
          supabaseAdmin.from("workspace_user_warehouses").insert(
            payload.patch.warehouseIds.map((warehouseId) => ({
              user_id: payload.id,
              warehouse_id: warehouseId,
            })),
          ),
        );
      }
    }
    await logAudit(payload.workspaceId, actorUser.name, "Editó usuario", await userDetailById(payload.id));
    return;
  }

  if (action === "deleteUser") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const detail = await userDetailById(payload.id);
    await db(supabaseAdmin.from("workspace_users").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Baja de usuario", detail);
    return;
  }

  if (action === "addWarehouse") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("name")
      .eq("id", payload.workspaceId)
      .maybeSingle();
    if (workspaceError) throw new Error(workspaceError.message);
    if (!workspace) throw new Error("Workspace no encontrado.");
    const centralRows = await db<{ id: string }[]>(
      supabaseAdmin
        .from("warehouses")
        .select("id")
        .eq("workspace_id", payload.workspaceId)
        .eq("type", "central")
        .is("deleted_at", null),
    );
    const hasCentral = centralRows.length > 0;
    if (!hasCentral && payload.warehouse.type !== "central") {
      throw new Error("El primer depósito del workspace debe ser de tipo Central.");
    }
    if (hasCentral && payload.warehouse.type === "central") {
      throw new Error("Ya existe un depósito Central en este workspace.");
    }

    await db(
      supabaseAdmin.from("warehouses").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        name: payload.warehouse.name.trim(),
        type: payload.warehouse.type,
        unit: workspace.name,
      }),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Alta de depósito", payload.warehouse.name);
    return;
  }

  if (action === "updateWarehouse") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const currentWarehouse = await getWarehouseById(payload.id);
    if (!currentWarehouse || currentWarehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito no encontrado en el workspace actual.");
    }
    if (currentWarehouse.deleted_at) {
      throw new Error("No se puede editar un depósito dado de baja.");
    }
    if (payload.patch.type !== undefined) {
      const otherCentralRows = await db<{ id: string }[]>(
        supabaseAdmin
          .from("warehouses")
          .select("id")
          .eq("workspace_id", payload.workspaceId)
          .eq("type", "central")
          .is("deleted_at", null)
          .neq("id", payload.id),
      );
      const hasAnotherCentral = otherCentralRows.length > 0;
      if (payload.patch.type === "central" && hasAnotherCentral) {
        throw new Error("Ya existe otro depósito Central en este workspace.");
      }
      if (currentWarehouse.type === "central" && payload.patch.type !== "central" && !hasAnotherCentral) {
        throw new Error("Debe existir al menos un depósito Central en el workspace.");
      }
    }
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) dbPatch.name = payload.patch.name.trim();
    if (payload.patch.type !== undefined) dbPatch.type = payload.patch.type;
    await db(supabaseAdmin.from("warehouses").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Editó depósito", await warehouseDetailById(payload.id));
    return;
  }

  if (action === "deleteWarehouse") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const warehouse = await getWarehouseById(payload.id);
    if (!warehouse || warehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito no encontrado o no pertenece al workspace.");
    }
    if (warehouse.deleted_at) {
      throw new Error("Este depósito ya fue dado de baja.");
    }
    const { data: batchRows, error: batchErr } = await supabaseAdmin
      .from("batches")
      .select("quantity")
      .eq("warehouse_id", payload.id);
    if (batchErr) throw new Error(batchErr.message);
    const stockTotal = (batchRows ?? []).reduce((s, r) => s + Number((r as { quantity: number }).quantity ?? 0), 0);
    if (stockTotal > 0) {
      throw new Error(
        "No se puede eliminar el depósito: aún tiene stock en al menos un lote. Transferí, vendé o ajustá el stock hasta dejarlo en cero.",
      );
    }
    const { data: trRows, error: trErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("status, from_warehouse_id, to_warehouse_id")
      .eq("workspace_id", payload.workspaceId);
    if (trErr) throw new Error(trErr.message);
    const terminal = new Set(["aceptado", "rechazado"]);
    const activeTransfers = (trRows ?? []).filter(
      (t) =>
        ((t as { from_warehouse_id: string }).from_warehouse_id === payload.id ||
          (t as { to_warehouse_id: string }).to_warehouse_id === payload.id) &&
        !terminal.has((t as { status: string }).status),
    );
    if (activeTransfers.length > 0) {
      throw new Error(
        "No se puede eliminar el depósito: hay transferencias de stock activas (no finalizadas en aceptada o rechazada) que lo involucran como origen o destino.",
      );
    }
    const detail = await warehouseDetailById(payload.id);
    await db(
      supabaseAdmin.from("warehouses").update({ deleted_at: new Date().toISOString() }).eq("id", payload.id),
    );
    await db(supabaseAdmin.from("workspace_user_warehouses").delete().eq("warehouse_id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Baja de depósito", detail);
    return;
  }

  if (action === "resetWorkspace") {
    const warehouseRows = await db<{ id: string }[]>(
      supabaseAdmin.from("warehouses").select("id").eq("workspace_id", payload.workspaceId),
    );
    const warehouseIds = warehouseRows.map((w) => w.id);

    if (warehouseIds.length > 0) {
      await db(supabaseAdmin.from("batches").delete().in("warehouse_id", warehouseIds));
    }

    await db(supabaseAdmin.from("transfer_requests").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("sales").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("dispensations").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("medication_orders").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("movements").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("medications").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("patients").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("warehouses").delete().eq("workspace_id", payload.workspaceId));
    await db(supabaseAdmin.from("audit_log").delete().eq("workspace_id", payload.workspaceId));
    return;
  }

  if (action === "addPatient") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const newPatientId = randomUUID();
    let computedRoom = payload.patient.room;

    if (payload.bedId) {
      const { data: bedRow, error: bedError } = await supabaseAdmin
        .from("beds")
        .select("*, rooms!inner(workspace_id, full_number)")
        .eq("id", payload.bedId)
        .maybeSingle();
      if (bedError) throw new Error(bedError.message);
      if (!bedRow) throw new Error("Cama seleccionada no encontrada.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bedRoom = (bedRow as any).rooms as { workspace_id: string; full_number: number } | null;
      if (!bedRoom || bedRoom.workspace_id !== payload.workspaceId) {
        throw new Error("La cama seleccionada no pertenece al workspace actual.");
      }
      if (bedRow.patient_id) {
        throw new Error("La cama seleccionada ya tiene un paciente asignado.");
      }
      computedRoom = String(bedRoom.full_number);
    }

    await db(
      supabaseAdmin.from("patients").insert({
        id: newPatientId,
        workspace_id: payload.workspaceId,
        first_name: payload.patient.firstName,
        last_name: payload.patient.lastName,
        insurance: payload.patient.insurance,
        diagnosis: payload.patient.diagnosis,
        assigned_doctor: payload.patient.assignedDoctor,
        room: computedRoom,
      }),
    );

    if (payload.bedId) {
      await db(
        supabaseAdmin
          .from("beds")
          .update({ patient_id: newPatientId })
          .eq("id", payload.bedId),
      );
    }

    await logAudit(
      payload.workspaceId,
      actorUser.name,
      "Alta de paciente",
      `${payload.patient.lastName}, ${payload.patient.firstName}${payload.bedId ? ` · Sala ${computedRoom}` : ""}`,
    );
    return;
  }

  if (action === "updatePatient") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.firstName !== undefined) dbPatch.first_name = payload.patch.firstName;
    if (payload.patch.lastName !== undefined) dbPatch.last_name = payload.patch.lastName;
    if (payload.patch.insurance !== undefined) dbPatch.insurance = payload.patch.insurance;
    if (payload.patch.diagnosis !== undefined) dbPatch.diagnosis = payload.patch.diagnosis;
    if (payload.patch.assignedDoctor !== undefined) dbPatch.assigned_doctor = payload.patch.assignedDoctor;
    if (payload.patch.room !== undefined) dbPatch.room = payload.patch.room;
    await db(supabaseAdmin.from("patients").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Editó paciente", `Paciente #${payload.id}`);
    return;
  }

  if (action === "deletePatient") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    await db(supabaseAdmin.from("patients").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Baja de paciente", `Paciente #${payload.id}`);
    return;
  }

  if (action === "addWing") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede crear alas médicas.");
    }
    const name = payload.wing.name.trim();
    if (!name) throw new Error("El nombre del ala es obligatorio.");
    const prefix = Math.trunc(Number(payload.wing.prefix));
    if (!Number.isFinite(prefix) || prefix < 1 || prefix > 9) {
      throw new Error("El prefijo debe ser un dígito entre 1 y 9.");
    }
    const { data: prefixDup } = await supabaseAdmin
      .from("wings")
      .select("id")
      .eq("workspace_id", payload.workspaceId)
      .eq("prefix", prefix)
      .maybeSingle();
    if (prefixDup) throw new Error(`Ya existe un ala con prefijo ${prefix}xx en este workspace.`);
    const { data: nameDup } = await supabaseAdmin
      .from("wings")
      .select("id")
      .eq("workspace_id", payload.workspaceId)
      .ilike("name", name)
      .maybeSingle();
    if (nameDup) throw new Error("Ya existe un ala con ese nombre en este workspace.");

    await db(
      supabaseAdmin.from("wings").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        name,
        type: payload.wing.type,
        prefix,
      }),
    );
    await logAudit(payload.workspaceId, actorUser.name, "Alta de ala médica", `${name} (${prefix}xx)`);
    return;
  }

  if (action === "updateWing") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede editar alas médicas.");
    }
    const { data: current, error } = await supabaseAdmin
      .from("wings")
      .select("*")
      .eq("id", payload.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current || current.workspace_id !== payload.workspaceId) {
      throw new Error("Ala no encontrada en el workspace actual.");
    }
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) {
      const name = payload.patch.name.trim();
      if (!name) throw new Error("El nombre del ala es obligatorio.");
      const { data: nameDup } = await supabaseAdmin
        .from("wings")
        .select("id")
        .eq("workspace_id", payload.workspaceId)
        .ilike("name", name)
        .neq("id", payload.id)
        .maybeSingle();
      if (nameDup) throw new Error("Ya existe un ala con ese nombre en este workspace.");
      dbPatch.name = name;
    }
    if (payload.patch.type !== undefined) {
      dbPatch.type = payload.patch.type;
    }
    if (payload.patch.prefix !== undefined) {
      const prefix = Math.trunc(Number(payload.patch.prefix));
      if (!Number.isFinite(prefix) || prefix < 1 || prefix > 9) {
        throw new Error("El prefijo debe ser un dígito entre 1 y 9.");
      }
      const { data: prefixDup } = await supabaseAdmin
        .from("wings")
        .select("id")
        .eq("workspace_id", payload.workspaceId)
        .eq("prefix", prefix)
        .neq("id", payload.id)
        .maybeSingle();
      if (prefixDup) throw new Error(`Ya existe un ala con prefijo ${prefix}xx en este workspace.`);
      dbPatch.prefix = prefix;
    }
    if (Object.keys(dbPatch).length === 0) return;
    await db(supabaseAdmin.from("wings").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Editó ala médica", `Ala #${payload.id}`);
    return;
  }

  if (action === "deleteWing") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede eliminar alas médicas.");
    }
    const { data: rooms, error: rError } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("wing_id", payload.id);
    if (rError) throw new Error(rError.message);
    if ((rooms ?? []).length > 0) {
      throw new Error("No se puede eliminar el ala: tiene salas asociadas. Eliminá primero las salas.");
    }
    await db(supabaseAdmin.from("wings").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Baja de ala médica", `Ala #${payload.id}`);
    return;
  }

  if (action === "addRoom") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede crear salas.");
    }
    const number = Math.trunc(Number(payload.room.number));
    if (!Number.isFinite(number) || number < 1 || number > 99) {
      throw new Error("El número de sala debe estar entre 01 y 99.");
    }
    const bedCount = Math.trunc(Number(payload.room.bedCount));
    if (!Number.isFinite(bedCount) || bedCount < 1 || bedCount > 4) {
      throw new Error("La sala debe tener entre 1 y 4 camas.");
    }
    const { data: wing, error: wingError } = await supabaseAdmin
      .from("wings")
      .select("*")
      .eq("id", payload.room.wingId)
      .maybeSingle();
    if (wingError) throw new Error(wingError.message);
    if (!wing || wing.workspace_id !== payload.workspaceId) {
      throw new Error("El ala seleccionada no existe en este workspace.");
    }
    const { data: dup } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("workspace_id", payload.workspaceId)
      .eq("wing_id", payload.room.wingId)
      .eq("number", number)
      .maybeSingle();
    if (dup) throw new Error(`Ya existe una sala con número ${String(number).padStart(2, "0")} en esta ala.`);

    const fullNumber = Number(wing.prefix) * 100 + number;
    const { data: dupFull } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("workspace_id", payload.workspaceId)
      .eq("full_number", fullNumber)
      .maybeSingle();
    if (dupFull) throw new Error(`Ya existe una sala con número ${fullNumber} en el workspace.`);

    await db(
      supabaseAdmin.from("rooms").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        wing_id: payload.room.wingId,
        number,
        bed_count: bedCount,
      }),
    );
    await logAudit(
      payload.workspaceId,
      actorUser.name,
      "Alta de sala",
      `Sala ${fullNumber} · ${bedCount} cama${bedCount === 1 ? "" : "s"}`,
    );
    return;
  }

  if (action === "updateRoom") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede editar salas.");
    }
    const { data: current, error } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("id", payload.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current || current.workspace_id !== payload.workspaceId) {
      throw new Error("Sala no encontrada en el workspace actual.");
    }
    const targetWingId = payload.patch.wingId ?? current.wing_id;
    const targetNumber = payload.patch.number ?? current.number;
    const targetBedCount = payload.patch.bedCount ?? current.bed_count;

    if (targetBedCount < 1 || targetBedCount > 4) {
      throw new Error("La sala debe tener entre 1 y 4 camas.");
    }
    if (targetNumber < 1 || targetNumber > 99) {
      throw new Error("El número de sala debe estar entre 01 y 99.");
    }

    const { data: wing, error: wingError } = await supabaseAdmin
      .from("wings")
      .select("*")
      .eq("id", targetWingId)
      .maybeSingle();
    if (wingError) throw new Error(wingError.message);
    if (!wing || wing.workspace_id !== payload.workspaceId) {
      throw new Error("El ala seleccionada no existe en este workspace.");
    }

    if (payload.patch.wingId !== undefined || payload.patch.number !== undefined) {
      const { data: dup } = await supabaseAdmin
        .from("rooms")
        .select("id")
        .eq("workspace_id", payload.workspaceId)
        .eq("wing_id", targetWingId)
        .eq("number", targetNumber)
        .neq("id", payload.id)
        .maybeSingle();
      if (dup) throw new Error(`Ya existe una sala con número ${String(targetNumber).padStart(2, "0")} en esa ala.`);
      const fullNumber = Number(wing.prefix) * 100 + targetNumber;
      const { data: dupFull } = await supabaseAdmin
        .from("rooms")
        .select("id")
        .eq("workspace_id", payload.workspaceId)
        .eq("full_number", fullNumber)
        .neq("id", payload.id)
        .maybeSingle();
      if (dupFull) throw new Error(`Ya existe una sala con número ${fullNumber} en el workspace.`);
    }

    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.wingId !== undefined) dbPatch.wing_id = payload.patch.wingId;
    if (payload.patch.number !== undefined) dbPatch.number = payload.patch.number;
    if (payload.patch.bedCount !== undefined) dbPatch.bed_count = payload.patch.bedCount;
    if (Object.keys(dbPatch).length === 0) return;

    await db(supabaseAdmin.from("rooms").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Editó sala", `Sala #${payload.id}`);
    return;
  }

  if (action === "deleteRoom") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    if (actorUser.role !== "admin") {
      throw new Error("Solo administración puede eliminar salas.");
    }
    const { data: current } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("id", payload.id)
      .maybeSingle();
    if (!current || current.workspace_id !== payload.workspaceId) {
      throw new Error("Sala no encontrada en el workspace actual.");
    }
    const { data: occupiedBeds } = await supabaseAdmin
      .from("beds")
      .select("id")
      .eq("room_id", payload.id)
      .not("patient_id", "is", null);
    if ((occupiedBeds ?? []).length > 0) {
      throw new Error("No se puede eliminar la sala: tiene camas con pacientes asignados.");
    }
    await db(supabaseAdmin.from("rooms").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, actorUser.name, "Baja de sala", `Sala ${current.full_number}`);
    return;
  }

  if (action === "assignBed") {
    const actorUser = await resolveActorUser(payload.workspaceId, payload.actor);
    const { data: bed, error } = await supabaseAdmin
      .from("beds")
      .select("*, rooms!inner(workspace_id, full_number)")
      .eq("id", payload.bedId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bed) throw new Error("Cama no encontrada.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const room = (bed as any).rooms as { workspace_id: string; full_number: number } | null;
    if (!room || room.workspace_id !== payload.workspaceId) {
      throw new Error("La cama no pertenece al workspace actual.");
    }

    if (payload.patientId) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id, workspace_id, first_name, last_name")
        .eq("id", payload.patientId)
        .maybeSingle();
      if (!patient || patient.workspace_id !== payload.workspaceId) {
        throw new Error("Paciente no encontrado en este workspace.");
      }
      if (bed.patient_id && bed.patient_id !== payload.patientId) {
        throw new Error("La cama destino ya tiene otro paciente asignado.");
      }
      // Liberamos automáticamente la cama previa del paciente (si existía).
      await db(
        supabaseAdmin
          .from("beds")
          .update({ patient_id: null })
          .eq("patient_id", payload.patientId)
          .neq("id", payload.bedId),
      );

      await db(
        supabaseAdmin
          .from("beds")
          .update({ patient_id: payload.patientId })
          .eq("id", payload.bedId),
      );
      await db(
        supabaseAdmin
          .from("patients")
          .update({ room: String(room.full_number) })
          .eq("id", payload.patientId),
      );
      await logAudit(
        payload.workspaceId,
        actorUser.name,
        "Asignación de cama",
        `${patient.last_name}, ${patient.first_name} → Sala ${room.full_number} · Cama ${bed.position}`,
      );
    } else {
      const prevPatientId = bed.patient_id as string | null;
      await db(
        supabaseAdmin.from("beds").update({ patient_id: null }).eq("id", payload.bedId),
      );
      if (prevPatientId) {
        await db(
          supabaseAdmin.from("patients").update({ room: "" }).eq("id", prevPatientId),
        );
      }
      await logAudit(
        payload.workspaceId,
        actorUser.name,
        "Liberación de cama",
        `Sala ${room.full_number} · Cama ${bed.position}`,
      );
    }
    return;
  }
}

export async function updateStockConfig(
  actor: string,
  workspaceId: string,
  medicationId: string,
  warehouseId: string,
  minStock: number,
  optimalStock: number,
): Promise<void> {
  await assertMedicationActiveForWorkspace(workspaceId, medicationId);
  const wh = await getWarehouseById(warehouseId);
  if (!wh || wh.workspace_id !== workspaceId) throw new Error("El depósito no pertenece a esta institución");
  const user = await resolveActorUser(workspaceId, actor);
  if (user.role !== "admin") throw new Error("Solo administradores pueden modificar la configuración de stock");
  const { error } = await supabaseAdmin
    .from("medication_stock_config")
    .upsert({
      medication_id: medicationId,
      warehouse_id: warehouseId,
      min_stock: minStock,
      optimal_stock: optimalStock,
    }, { onConflict: "medication_id,warehouse_id" });
  if (error) throw new Error(`Error al actualizar: ${error.message}`);
}

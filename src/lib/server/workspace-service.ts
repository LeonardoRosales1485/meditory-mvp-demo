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

async function getWarehouseById(warehouseId: string) {
  const { data, error } = await supabaseAdmin
    .from("warehouses")
    .select("id, workspace_id, name, type")
    .eq("id", warehouseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function resolveActorUser(workspaceId: string, actor: string) {
  const baseQuery = supabaseAdmin
    .from("workspace_users")
    .select("id, role, name")
    .eq("workspace_id", workspaceId)
    .eq("name", actor)
    .order("id", { ascending: true })
    .limit(1);

  const { data: activeData, error: activeError } = await baseQuery.eq("is_active", true).maybeSingle();
  if (!activeError) {
    if (!activeData) throw new Error("No se pudo validar el usuario actor en este workspace.");
    return activeData as { id: string; role: string; name: string };
  }

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from("workspace_users")
    .select("id, role, name")
    .eq("workspace_id", workspaceId)
    .eq("name", actor)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw new Error(fallbackError.message);
  if (!fallbackData) throw new Error("No se pudo validar el usuario actor en este workspace.");
  return fallbackData as { id: string; role: string; name: string };
}

async function assertWarehouseAccess(workspaceId: string, actor: string, warehouseId: string) {
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
  };
}

export async function runAction<K extends keyof ActionPayloadMap>(action: K, payload: ActionPayloadMap[K]) {
  if (action === "addMedication") {
    await db(
      supabaseAdmin.from("medications").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        name: payload.medication.name,
        active_ingredient: payload.medication.activeIngredient,
        concentration_value: payload.medication.concentrationValue,
        concentration_unit: payload.medication.concentrationUnit,
        form: payload.medication.form,
      }),
    );
    await logAudit(payload.workspaceId, payload.actor, "Alta de medicamento", payload.medication.name);
    return;
  }

  if (action === "updateMedication") {
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) dbPatch.name = payload.patch.name;
    if (payload.patch.activeIngredient !== undefined) dbPatch.active_ingredient = payload.patch.activeIngredient;
    if (payload.patch.concentrationValue !== undefined) dbPatch.concentration_value = payload.patch.concentrationValue;
    if (payload.patch.concentrationUnit !== undefined) dbPatch.concentration_unit = payload.patch.concentrationUnit;
    if (payload.patch.form !== undefined) dbPatch.form = payload.patch.form;
    await db(supabaseAdmin.from("medications").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Editó medicamento", await medicationDetailById(payload.id));
    return;
  }

  if (action === "deleteMedication") {
    const detail = await medicationDetailById(payload.id);
    await db(supabaseAdmin.from("medications").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Eliminó medicamento", detail);
    return;
  }

  if (action === "addReceipt") {
    const warehouse = await getWarehouseById(payload.warehouseId);
    if (!warehouse || warehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito inválido para el workspace actual.");
    }
    if (warehouse.type !== "central") {
      throw new Error("Los ingresos solo pueden registrarse en el depósito central.");
    }
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
          user_name: payload.actor,
          reason: payload.reason ?? `Ingreso lote ${payload.lot}`,
          date: new Date().toISOString(),
        }),
      );
    } catch (error) {
      await db(supabaseAdmin.from("batches").delete().eq("id", insertedBatch.id));
      throw error;
    }
    await logAudit(payload.workspaceId, payload.actor, "Ingreso de mercadería", `Lote ${payload.lot}`);
    return;
  }

  if (action === "adjustStock") {
    const { data: batch, error: batchError } = await supabaseAdmin.from("batches").select("*").eq("id", payload.batchId).maybeSingle();
    if (batchError) throw new Error(batchError.message);
    if (!batch) throw new Error("Lote no encontrado");
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
        user_name: payload.actor,
        reason: `Ajuste lote ${batch.lot}: ${payload.reason}`,
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, payload.actor, "Ajuste de stock", `${batch.lot} (${payload.delta})`);
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
    if (fromWarehouse.type !== "central") {
      throw new Error("Las transferencias deben originarse en el depósito central.");
    }
    if (payload.fromWarehouseId === payload.toWarehouseId) {
      throw new Error("Origen y destino deben ser distintos.");
    }
    const sourceBatch = await getBatchById(payload.sourceBatchId);
    if (!sourceBatch) throw new Error("Lote origen no encontrado.");
    if (sourceBatch.medication_id !== payload.medicationId || sourceBatch.warehouse_id !== payload.fromWarehouseId) {
      throw new Error("El lote seleccionado no corresponde al medicamento/deposito origen.");
    }
    if (Number(sourceBatch.quantity) < payload.quantity) {
      throw new Error("El lote seleccionado no tiene stock suficiente.");
    }

    const transferId = randomUUID();
    const transferCode = await nextTransferCode(payload.workspaceId);
    await db(
      supabaseAdmin.from("transfer_requests").insert({
        id: transferId,
        workspace_id: payload.workspaceId,
        transfer_code: transferCode,
        medication_id: payload.medicationId,
        source_batch_id: payload.sourceBatchId,
        from_warehouse_id: payload.fromWarehouseId,
        to_warehouse_id: payload.toWarehouseId,
        quantity: payload.quantity,
        status: "solicitado",
        requested_by: payload.actor,
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
    await logAudit(payload.workspaceId, payload.actor, "Transferencia solicitada", detail);
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
          user_name: payload.actor,
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
          user_name: payload.actor,
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
    await logAudit(payload.workspaceId, payload.actor, `Transferencia ${next}`, detail);
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
          user_name: payload.actor,
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
      payload.actor,
      "Transferencia rechazada",
      `${detail} · Resolución: ${payload.outcome} · Motivo: ${payload.reason}`,
    );
    return;
  }

  if (action === "addSale") {
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
        cashier: payload.actor,
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
        user_name: payload.actor,
        reason: "Venta registrada",
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, payload.actor, "Venta registrada", await medicationDetailById(payload.medicationId));
    return;
  }

  if (action === "addDispensation") {
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
        user_name: payload.actor,
        reason: `${payload.room} · ${payload.doctor} · ${payload.patient}`,
        date: new Date().toISOString(),
      }),
    );
    await logAudit(payload.workspaceId, payload.actor, "Dispensación interna", `${payload.patient} (${payload.room})`);
    return;
  }

  if (action === "createOrder") {
    const sourceBatch = await getBatchById(payload.sourceBatchId);
    if (!sourceBatch) throw new Error("Lote seleccionado no encontrado.");
    if (sourceBatch.medication_id !== payload.medicationId || sourceBatch.warehouse_id !== payload.warehouseId) {
      throw new Error("El lote seleccionado no corresponde al medicamento/deposito del pedido.");
    }
    if (Number(sourceBatch.quantity) < payload.quantity) {
      throw new Error("El lote seleccionado no tiene stock suficiente.");
    }
    const requestedDoctor = payload.doctorName?.trim() || payload.actor;
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
      payload.actor,
      "Pedido de medicación",
      `${payload.patient} (${payload.room}) · Médico: ${requestedDoctor}${requestedDoctor !== payload.actor ? ` · Cargado por: ${payload.actor}` : ""}`,
    );
    return;
  }

  if (action === "processOrder") {
    const { data: order, error: orderError } = await supabaseAdmin.from("medication_orders").select("*").eq("id", payload.id).maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Pedido no encontrado");
    if (
      payload.action === "confirmar_recepcion" &&
      payload.actorRole !== "admin" &&
      payload.actor !== order.doctor
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
        .update({ status: next, processed_at: new Date().toISOString(), processed_by: payload.actor })
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
          user_name: payload.actor,
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
          user_name: payload.actor,
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
          user_name: payload.actor,
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
          user_name: payload.actor,
          reason: `Devolución rechazada pedido ${order.id}: ${payload.reason ?? "Sin motivo"}`,
          date: new Date().toISOString(),
        }),
      );
    }
    await logAudit(
      payload.workspaceId,
      payload.actor,
      `Pedido ${payload.action}`,
      `Pedido #${order.id} · ${order.quantity}u · Paciente ${order.patient} · Habitación ${order.room}${payload.reason ? ` · Motivo: ${payload.reason}` : ""}`,
    );
    return;
  }

  if (action === "addUser") {
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
      await db(
        supabaseAdmin.from("workspace_user_warehouses").insert(
          payload.user.warehouseIds.map((warehouseId) => ({
            user_id: createdUser.id,
            warehouse_id: warehouseId,
          })),
        ),
      );
    }
    await logAudit(payload.workspaceId, payload.actor, "Alta de usuario", `${payload.user.name} (${payload.user.role})`);
    return;
  }

  if (action === "updateUser") {
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.name !== undefined) dbPatch.name = payload.patch.name;
    if (payload.patch.email !== undefined) dbPatch.email = payload.patch.email.toLowerCase();
    if (payload.patch.role !== undefined) dbPatch.role = payload.patch.role;
    await db(supabaseAdmin.from("workspace_users").update(dbPatch).eq("id", payload.id));
    if (payload.patch.warehouseIds !== undefined) {
      await db(supabaseAdmin.from("workspace_user_warehouses").delete().eq("user_id", payload.id));
      if (payload.patch.warehouseIds.length > 0) {
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
    await logAudit(payload.workspaceId, payload.actor, "Editó usuario", await userDetailById(payload.id));
    return;
  }

  if (action === "deleteUser") {
    const detail = await userDetailById(payload.id);
    await db(supabaseAdmin.from("workspace_users").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Baja de usuario", detail);
    return;
  }

  if (action === "addWarehouse") {
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
        .eq("type", "central"),
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
    await logAudit(payload.workspaceId, payload.actor, "Alta de depósito", payload.warehouse.name);
    return;
  }

  if (action === "updateWarehouse") {
    const currentWarehouse = await getWarehouseById(payload.id);
    if (!currentWarehouse || currentWarehouse.workspace_id !== payload.workspaceId) {
      throw new Error("Depósito no encontrado en el workspace actual.");
    }
    if (payload.patch.type !== undefined) {
      const otherCentralRows = await db<{ id: string }[]>(
        supabaseAdmin
          .from("warehouses")
          .select("id")
          .eq("workspace_id", payload.workspaceId)
          .eq("type", "central")
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
    await logAudit(payload.workspaceId, payload.actor, "Editó depósito", await warehouseDetailById(payload.id));
    return;
  }

  if (action === "deleteWarehouse") {
    const detail = await warehouseDetailById(payload.id);
    await db(supabaseAdmin.from("warehouses").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Baja de depósito", detail);
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
    await db(
      supabaseAdmin.from("patients").insert({
        id: randomUUID(),
        workspace_id: payload.workspaceId,
        first_name: payload.patient.firstName,
        last_name: payload.patient.lastName,
        insurance: payload.patient.insurance,
        diagnosis: payload.patient.diagnosis,
        assigned_doctor: payload.patient.assignedDoctor,
        room: payload.patient.room,
      }),
    );
    await logAudit(payload.workspaceId, payload.actor, "Alta de paciente", `${payload.patient.lastName}, ${payload.patient.firstName}`);
    return;
  }

  if (action === "updatePatient") {
    const dbPatch: Record<string, unknown> = {};
    if (payload.patch.firstName !== undefined) dbPatch.first_name = payload.patch.firstName;
    if (payload.patch.lastName !== undefined) dbPatch.last_name = payload.patch.lastName;
    if (payload.patch.insurance !== undefined) dbPatch.insurance = payload.patch.insurance;
    if (payload.patch.diagnosis !== undefined) dbPatch.diagnosis = payload.patch.diagnosis;
    if (payload.patch.assignedDoctor !== undefined) dbPatch.assigned_doctor = payload.patch.assignedDoctor;
    if (payload.patch.room !== undefined) dbPatch.room = payload.patch.room;
    await db(supabaseAdmin.from("patients").update(dbPatch).eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Editó paciente", `Paciente #${payload.id}`);
    return;
  }

  if (action === "deletePatient") {
    await db(supabaseAdmin.from("patients").delete().eq("id", payload.id));
    await logAudit(payload.workspaceId, payload.actor, "Baja de paciente", `Paciente #${payload.id}`);
  }
}

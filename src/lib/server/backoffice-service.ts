import { supabaseAdmin } from "./supabase-admin";
import { randomUUID } from "node:crypto";

async function db<T>(promise: Promise<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? ([] as unknown as T));
}

export type BackofficeSession = { id: string; email: string; name: string };

export async function backofficeLogin(email: string, password: string): Promise<BackofficeSession | null> {
  const { data, error } = await supabaseAdmin
    .from("super_admins")
    .select("id, email, name")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: pwData, error: pwError } = await supabaseAdmin.rpc("check_super_admin_password", {
    p_email: email.trim().toLowerCase(),
    p_password: password,
  });
  if (pwError) throw new Error(pwError.message);
  if (!pwData) return null;

  return data as BackofficeSession;
}

export async function listWorkspaces() {
  return db<object[]>(
    supabaseAdmin.from("workspaces").select("id, name, slug, created_at").order("name"),
  );
}

export async function createWorkspace(data: { name: string; slug: string }) {
  await db(
    supabaseAdmin.from("workspaces").insert({
      id: randomUUID(),
      name: data.name.trim(),
      slug: data.slug.trim().toUpperCase(),
    }),
  );
}

export async function updateWorkspace(data: { id: string; patch: { name?: string; slug?: string } }) {
  const dbPatch: Record<string, unknown> = {};
  if (data.patch.name !== undefined) dbPatch.name = data.patch.name.trim();
  if (data.patch.slug !== undefined) dbPatch.slug = data.patch.slug.trim().toUpperCase();
  await db(supabaseAdmin.from("workspaces").update(dbPatch).eq("id", data.id));
}

export async function deleteWorkspace(id: string) {
  await db(supabaseAdmin.from("workspaces").delete().eq("id", id));
}

export async function listUsers() {
  return db<object[]>(
    supabaseAdmin
      .from("workspace_users")
      .select("id, workspace_id, name, email, role, workspaces:workspace_id(name)")
      .order("name"),
  );
}

export async function createUser(data: {
  workspaceId: string;
  name: string;
  email: string;
  role: string;
  warehouseIds: string[];
}) {
  const userId = randomUUID();
  await db(
    supabaseAdmin.from("workspace_users").insert({
      id: userId,
      workspace_id: data.workspaceId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: data.role,
    }),
  );
  if (data.warehouseIds.length > 0) {
    await db(
      supabaseAdmin.from("workspace_user_warehouses").insert(
        data.warehouseIds.map((whId) => ({
          user_id: userId,
          warehouse_id: whId,
        })),
      ),
    );
  }
}

export async function updateUser(data: {
  id: string;
  patch: { name?: string; email?: string; role?: string; warehouseIds?: string[] };
}) {
  const dbPatch: Record<string, unknown> = {};
  if (data.patch.name !== undefined) dbPatch.name = data.patch.name.trim();
  if (data.patch.email !== undefined) dbPatch.email = data.patch.email.trim().toLowerCase();
  if (data.patch.role !== undefined) dbPatch.role = data.patch.role;
  if (Object.keys(dbPatch).length > 0) {
    await db(supabaseAdmin.from("workspace_users").update(dbPatch).eq("id", data.id));
  }
  if (data.patch.warehouseIds !== undefined) {
    await db(supabaseAdmin.from("workspace_user_warehouses").delete().eq("user_id", data.id));
    if (data.patch.warehouseIds.length > 0) {
      await db(
        supabaseAdmin.from("workspace_user_warehouses").insert(
          data.patch.warehouseIds.map((whId) => ({
            user_id: data.id,
            warehouse_id: whId,
          })),
        ),
      );
    }
  }
}

export async function deleteUser(id: string) {
  await db(supabaseAdmin.from("workspace_user_warehouses").delete().eq("user_id", id));
  await db(supabaseAdmin.from("workspace_users").delete().eq("id", id));
}

export async function listWarehouses() {
  return db<object[]>(
    supabaseAdmin.from("warehouses").select("id, name, workspace_id, type, unit").order("name"),
  );
}

export async function getDashboardData() {
  const [workspaces, users, warehouses, batches, recentMovements] = await Promise.all([
    supabaseAdmin.from("workspaces").select("id, name, slug").order("name"),
    supabaseAdmin.from("workspace_users").select("id, workspace_id"),
    supabaseAdmin.from("warehouses").select("id, workspace_id"),
    supabaseAdmin.from("batches").select("medication_id, warehouse_id, quantity"),
    supabaseAdmin
      .from("movements")
      .select("workspace_id, type, medication_id, quantity, user_name, date")
      .order("date", { ascending: false })
      .limit(50),
  ]);

  if (workspaces.error) throw new Error(workspaces.error.message);
  if (users.error) throw new Error(users.error.message);
  if (warehouses.error) throw new Error(warehouses.error.message);
  if (batches.error) throw new Error(batches.error.message);
  if (recentMovements.error) throw new Error(recentMovements.error.message);

  const today = new Date().toDateString();

  const wsStats = (workspaces.data ?? []).map((ws) => {
    const wsId = (ws as { id: string }).id;
    const wsWarehouses = (warehouses.data ?? []).filter(
      (w) => (w as { workspace_id: string }).workspace_id === wsId,
    );
    const wsWarehouseIds = new Set(wsWarehouses.map((w) => (w as { id: string }).id));
    const wsBatches = (batches.data ?? []).filter((b) =>
      wsWarehouseIds.has((b as { warehouse_id: string }).warehouse_id),
    );
    const wsUsers = (users.data ?? []).filter(
      (u) => (u as { workspace_id: string }).workspace_id === wsId,
    );
    const wsMovementsToday = (recentMovements.data ?? []).filter(
      (m) =>
        (m as { workspace_id: string }).workspace_id === wsId &&
        new Date((m as { date: string }).date).toDateString() === today,
    );

    return {
      id: wsId,
      name: (ws as { name: string }).name,
      slug: (ws as { slug: string }).slug,
      totalUnits: wsBatches.reduce((s, b) => s + Number((b as { quantity: number }).quantity ?? 0), 0),
      totalBatches: wsBatches.length,
      totalUsers: wsUsers.length,
      totalWarehouses: wsWarehouses.length,
      movementsToday: wsMovementsToday.length,
      salesToday: 0,
      activeOrders: 0,
    };
  });

  return {
    workspaces: wsStats,
    totalWorkspaces: wsStats.length,
    totalUsers: (users.data ?? []).length,
    totalWarehouses: (warehouses.data ?? []).length,
    totalBatches: (batches.data ?? []).length,
    totalUnits: wsStats.reduce((s, ws) => s + ws.totalUnits, 0),
    recentMovements: (recentMovements.data ?? []).slice(0, 25),
  };
}

export async function getRealtimeData(workspaceId?: string) {
  let batchesQuery = supabaseAdmin.from("batches").select("*");
  let movementsQuery = supabaseAdmin.from("movements").select("*");
  let ordersQuery = supabaseAdmin.from("medication_orders").select("*");
  let transfersQuery = supabaseAdmin.from("transfer_requests").select("*");
  let warehousesQuery = supabaseAdmin.from("warehouses").select("*");

  if (workspaceId) {
    const whIds = (
      await db<{ id: string }[]>(
        supabaseAdmin.from("warehouses").select("id").eq("workspace_id", workspaceId),
      )
    ).map((w) => w.id);

    if (whIds.length > 0) {
      batchesQuery = batchesQuery.in("warehouse_id", whIds);
      movementsQuery = movementsQuery.in("warehouse_id", whIds);
      ordersQuery = ordersQuery.in("warehouse_id", whIds);
      transfersQuery = transfersQuery.or(`from_warehouse_id.in.(${whIds.join(",")}),to_warehouse_id.in.(${whIds.join(",")})`);
    }
  }

  const [batches, movements, orders, transfers, warehouses] = await Promise.all([
    db<object[]>(batchesQuery.order("expiry")),
    db<object[]>(movementsQuery.order("date", { ascending: false }).limit(200)),
    db<object[]>(ordersQuery.order("requested_at", { ascending: false }).limit(100)),
    db<object[]>(transfersQuery.order("date", { ascending: false }).limit(100)),
    db<object[]>(warehousesQuery.order("name")),
  ]);

  return { batches, movements, orders, transfers, warehouses };
}

export async function getConsumptionTrends(periodDays: number, workspaceId?: string) {
  const { data, error } = await supabaseAdmin.rpc("get_consumption_trends", {
    p_period_days: periodDays,
    p_workspace_id: workspaceId ?? null,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSchema() {
  const { data, error } = await supabaseAdmin.rpc("get_schema_info");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
//  NUEVAS FUNCIONES DEMO FINAL
// ─────────────────────────────────────────────────────────────

export interface CrossHospitalMedStock {
  medicationName: string;
  salePrice: number;
  stocks: {
    workspaceId: string;
    workspaceName: string;
    quantity: number;
    minStock: number;
    optimalStock: number;
  }[];
}

export async function getCrossHospitalStock(): Promise<CrossHospitalMedStock[]> {
  const [batchesRes, medsRes, warehousesRes, workspacesRes, stockCfgRes] = await Promise.all([
    supabaseAdmin.from("batches").select("medication_id, warehouse_id, quantity"),
    supabaseAdmin.from("medications").select("id, workspace_id, name, sale_price"),
    supabaseAdmin.from("warehouses").select("id, workspace_id"),
    supabaseAdmin.from("workspaces").select("id, name"),
    supabaseAdmin.from("medication_stock_config").select("medication_id, warehouse_id, min_stock, optimal_stock"),
  ]);

  const batches = (batchesRes.data ?? []) as { medication_id: string; warehouse_id: string; quantity: number }[];
  const meds = (medsRes.data ?? []) as { id: string; workspace_id: string; name: string; sale_price: number }[];
  const warehouses = (warehousesRes.data ?? []) as { id: string; workspace_id: string }[];
  const workspaces = (workspacesRes.data ?? []) as { id: string; name: string }[];
  const stockCfg = (stockCfgRes.data ?? []) as { medication_id: string; warehouse_id: string; min_stock: number; optimal_stock: number }[];

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.workspace_id]));
  const workspaceMap = new Map(workspaces.map((w) => [w.id, w.name]));

  // Agrupar stock por (medicación, workspace)
  const stockByMedWorkspace = new Map<string, Map<string, number>>();
  for (const batch of batches) {
    const wsId = warehouseMap.get(batch.warehouse_id);
    if (!wsId) continue;
    const key = batch.medication_id;
    if (!stockByMedWorkspace.has(key)) stockByMedWorkspace.set(key, new Map());
    const wsMap = stockByMedWorkspace.get(key)!;
    wsMap.set(wsId, (wsMap.get(wsId) ?? 0) + batch.quantity);
  }

  // Agrupar stock_config por (medicación, workspace)
  const cfgByMedWorkspace = new Map<string, Map<string, { min: number; opt: number }>>();
  for (const cfg of stockCfg) {
    const wsId = warehouseMap.get(cfg.warehouse_id);
    if (!wsId) continue;
    if (!cfgByMedWorkspace.has(cfg.medication_id)) cfgByMedWorkspace.set(cfg.medication_id, new Map());
    const wsMap = cfgByMedWorkspace.get(cfg.medication_id)!;
    const existing = wsMap.get(wsId) ?? { min: 0, opt: 0 };
    wsMap.set(wsId, { min: existing.min + cfg.min_stock, opt: existing.opt + cfg.optimal_stock });
  }

  // Agrupar medicamentos por nombre genérico (para comparativa cross-hospital)
  const medsByName = new Map<string, typeof meds>();
  for (const med of meds) {
    if (!medsByName.has(med.name)) medsByName.set(med.name, []);
    medsByName.get(med.name)!.push(med);
  }

  const result: CrossHospitalMedStock[] = [];

  for (const [medName, medsGroup] of medsByName) {
    const avgPrice = medsGroup.reduce((s, m) => s + (m.sale_price ?? 0), 0) / medsGroup.length;
    const wsStocks: CrossHospitalMedStock["stocks"] = [];

    for (const ws of workspaces) {
      // Buscar la medicación correspondiente a este workspace
      const med = medsGroup.find((m) => m.workspace_id === ws.id);
      if (!med) continue;

      const quantity = stockByMedWorkspace.get(med.id)?.get(ws.id) ?? 0;
      const cfg = cfgByMedWorkspace.get(med.id)?.get(ws.id) ?? { min: 0, opt: 0 };

      wsStocks.push({
        workspaceId: ws.id,
        workspaceName: ws.name,
        quantity,
        minStock: cfg.min,
        optimalStock: cfg.opt,
      });
    }

    if (wsStocks.length > 0) {
      result.push({ medicationName: medName, salePrice: avgPrice, stocks: wsStocks });
    }
  }

  return result.sort((a, b) => a.medicationName.localeCompare(b.medicationName));
}

export interface ProcurementItem {
  workspaceId: string;
  workspaceName: string;
  currentStock: number;
  minStock: number;
  optimalStock: number;
  deficit: number;
  surplus: number;
  orderWithoutTransfers: number;
  orderWithTransfers: number;
  costWithoutTransfers: number;
  costWithTransfers: number;
}

export interface ProcurementResult {
  medicationName: string;
  salePrice: number;
  items: ProcurementItem[];
  totalCostWithoutTransfers: number;
  totalCostWithTransfers: number;
  totalSaving: number;
}

export async function getProcurementOptimization(medicationId?: string): Promise<ProcurementResult[]> {
  const crossStock = await getCrossHospitalStock();
  const filtered = medicationId
    ? crossStock.filter((m) => m.medicationName.toLowerCase().includes(medicationId.toLowerCase()))
    : crossStock;

  return filtered.map((med) => {
    const totalSurplus = med.stocks.reduce((s, ws) => s + Math.max(0, ws.quantity - ws.optimalStock), 0);
    let remainingSurplus = totalSurplus;

    const items: ProcurementItem[] = med.stocks.map((ws) => {
      const deficit = Math.max(0, ws.optimalStock - ws.quantity);
      const surplus = Math.max(0, ws.quantity - ws.optimalStock);
      const orderWithoutTransfers = deficit;
      const transferCoverage = Math.min(deficit, remainingSurplus);
      remainingSurplus = Math.max(0, remainingSurplus - transferCoverage);
      const orderWithTransfers = Math.max(0, deficit - transferCoverage);

      return {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        currentStock: ws.quantity,
        minStock: ws.minStock,
        optimalStock: ws.optimalStock,
        deficit,
        surplus,
        orderWithoutTransfers,
        orderWithTransfers,
        costWithoutTransfers: orderWithoutTransfers * med.salePrice,
        costWithTransfers: orderWithTransfers * med.salePrice,
      };
    });

    const totalCostWithoutTransfers = items.reduce((s, i) => s + i.costWithoutTransfers, 0);
    const totalCostWithTransfers = items.reduce((s, i) => s + i.costWithTransfers, 0);

    return {
      medicationName: med.medicationName,
      salePrice: med.salePrice,
      items,
      totalCostWithoutTransfers,
      totalCostWithTransfers,
      totalSaving: totalCostWithoutTransfers - totalCostWithTransfers,
    };
  });
}

export interface LossCalculationResult {
  totalLossWithoutTransfers: number;
  totalSavingWithTransfers: number;
  byMedication: {
    medicationName: string;
    salePrice: number;
    surplusHospital: string;
    surplusQuantity: number;
    deficitHospital: string;
    deficitQuantity: number;
    currentLoss: number;
    potentialSaving: number;
  }[];
}

export async function getLossCalculation(): Promise<LossCalculationResult> {
  const crossStock = await getCrossHospitalStock();
  const byMedication: LossCalculationResult["byMedication"] = [];

  for (const med of crossStock) {
    const surplus = med.stocks.filter((ws) => ws.quantity > ws.optimalStock);
    const deficits = med.stocks.filter((ws) => ws.quantity < ws.minStock);

    for (const surplusWs of surplus) {
      for (const deficitWs of deficits) {
        const surplusQty = surplusWs.quantity - surplusWs.optimalStock;
        const deficitQty = deficitWs.minStock - deficitWs.quantity;
        const transferable = Math.min(surplusQty, deficitQty);
        const loss = surplusQty * med.salePrice;
        const saving = transferable * med.salePrice;

        if (surplusQty > 0 && deficitQty > 0) {
          byMedication.push({
            medicationName: med.medicationName,
            salePrice: med.salePrice,
            surplusHospital: surplusWs.workspaceName,
            surplusQuantity: surplusQty,
            deficitHospital: deficitWs.workspaceName,
            deficitQuantity: deficitQty,
            currentLoss: loss,
            potentialSaving: saving,
          });
        }
      }
    }
  }

  return {
    totalLossWithoutTransfers: byMedication.reduce((s, m) => s + m.currentLoss, 0),
    totalSavingWithTransfers: byMedication.reduce((s, m) => s + m.potentialSaving, 0),
    byMedication,
  };
}

export interface WarehouseVolumeItem {
  warehouseId: string;
  name: string;
  type: string;
  workspaceId: string;
  workspaceName: string;
  currentUnits: number;
  maxCapacity: number;
  occupancyPct: number;
}

export async function getWarehouseVolumeData(): Promise<WarehouseVolumeItem[]> {
  const [warehousesRes, batchesRes, workspacesRes] = await Promise.all([
    supabaseAdmin.from("warehouses").select("id, name, type, workspace_id, max_capacity, volume"),
    supabaseAdmin.from("batches").select("warehouse_id, quantity"),
    supabaseAdmin.from("workspaces").select("id, name"),
  ]);

  const warehouses = (warehousesRes.data ?? []) as {
    id: string; name: string; type: string; workspace_id: string; max_capacity: number; volume: number;
  }[];
  const batches = (batchesRes.data ?? []) as { warehouse_id: string; quantity: number }[];
  const workspaces = (workspacesRes.data ?? []) as { id: string; name: string }[];
  const workspaceMap = new Map(workspaces.map((w) => [w.id, w.name]));

  // Calcular stock actual por depósito
  const stockByWarehouse = new Map<string, number>();
  for (const b of batches) {
    stockByWarehouse.set(b.warehouse_id, (stockByWarehouse.get(b.warehouse_id) ?? 0) + b.quantity);
  }

  return warehouses.map((wh) => {
    const currentUnits = stockByWarehouse.get(wh.id) ?? 0;
    const maxCap = wh.max_capacity ?? 1000;
    const pct = maxCap > 0 ? Math.min(100, (currentUnits / maxCap) * 100) : 0;
    return {
      warehouseId: wh.id,
      name: wh.name,
      type: wh.type,
      workspaceId: wh.workspace_id,
      workspaceName: workspaceMap.get(wh.workspace_id) ?? wh.workspace_id,
      currentUnits,
      maxCapacity: maxCap,
      occupancyPct: Math.round(pct * 10) / 10,
    };
  }).sort((a, b) => a.workspaceName.localeCompare(b.workspaceName) || a.name.localeCompare(b.name));
}

export interface ConsumptionDataPoint {
  date: string;
  workspaceId: string;
  workspaceName: string;
  medicationName: string;
  totalConsumed: number;
}

export async function getConsumptionByMedication(periodDays = 30): Promise<ConsumptionDataPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const [movementsRes, medsRes, warehousesRes, workspacesRes] = await Promise.all([
    supabaseAdmin
      .from("movements")
      .select("medication_id, warehouse_id, quantity, date, type")
      .in("type", ["egreso", "dispensacion", "venta"])
      .gte("date", since.toISOString()),
    supabaseAdmin.from("medications").select("id, name, workspace_id"),
    supabaseAdmin.from("warehouses").select("id, workspace_id"),
    supabaseAdmin.from("workspaces").select("id, name"),
  ]);

  const movements = (movementsRes.data ?? []) as {
    medication_id: string; warehouse_id: string; quantity: number; date: string; type: string;
  }[];
  const meds = (medsRes.data ?? []) as { id: string; name: string; workspace_id: string }[];
  const warehouses = (warehousesRes.data ?? []) as { id: string; workspace_id: string }[];
  const workspaces = (workspacesRes.data ?? []) as { id: string; name: string }[];

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.workspace_id]));
  const workspaceMap = new Map(workspaces.map((w) => [w.id, w.name]));
  const medMap = new Map(meds.map((m) => [m.id, m]));

  const aggregated = new Map<string, number>();
  for (const mov of movements) {
    const med = medMap.get(mov.medication_id);
    if (!med) continue;
    const wsId = warehouseMap.get(mov.warehouse_id);
    if (!wsId) continue;
    const date = mov.date.substring(0, 10);
    const key = `${date}|${wsId}|${med.name}`;
    aggregated.set(key, (aggregated.get(key) ?? 0) + Math.abs(mov.quantity));
  }

  const result: ConsumptionDataPoint[] = [];
  for (const [key, total] of aggregated) {
    const [date, wsId, medName] = key.split("|");
    result.push({
      date,
      workspaceId: wsId,
      workspaceName: workspaceMap.get(wsId) ?? wsId,
      medicationName: medName,
      totalConsumed: total,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function resetWorkspaceData(workspaceId: string) {
  const warehouseRows = await db<{ id: string }[]>(
    supabaseAdmin.from("warehouses").select("id").eq("workspace_id", workspaceId),
  );
  const warehouseIds = warehouseRows.map((w) => w.id);

  if (warehouseIds.length > 0) {
    await db(supabaseAdmin.from("batches").delete().in("warehouse_id", warehouseIds));
  }

  await db(supabaseAdmin.from("transfer_requests").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("sales").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("dispensations").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("medication_orders").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("movements").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("medication_stock_config").delete().in("warehouse_id", warehouseIds));
  await db(supabaseAdmin.from("medications").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("patients").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("warehouses").delete().eq("workspace_id", workspaceId));
  await db(supabaseAdmin.from("audit_log").delete().eq("workspace_id", workspaceId));
}

export async function seedWorkspaceDemo(workspaceId: string, workspaceName: string) {
  const KNOWN = ["ws-aleman", "ws-francisco", "ws-blanco"] as const;

  if (!KNOWN.includes(workspaceId as typeof KNOWN[number])) {
    await seedGenericWorkspace(workspaceId, workspaceName);
    return;
  }

  await seedFullDemoWorkspace(workspaceId as typeof KNOWN[number]);
}

// ─── Known demo hospitals (023_reset_repopulate.sql) ─────────────────────

async function seedFullDemoWorkspace(ws: "ws-aleman" | "ws-francisco" | "ws-blanco") {
  const PREFIX = ws === "ws-aleman" ? "ale" : ws === "ws-francisco" ? "fco" : "bla";

  const WH_CENTRAL = `wh-${PREFIX === "ale" ? "aleman" : PREFIX === "fco" ? "fco" : "blanco"}-central`;
  const WH_INTERNA = `wh-${PREFIX === "ale" ? "aleman" : PREFIX === "fco" ? "fco" : "blanco"}-interna`;
  const WH_VENTAS  = `wh-${PREFIX === "ale" ? "aleman" : PREFIX === "fco" ? "fco" : "blanco"}-ventas`;

  const WS_NAME = ws === "ws-aleman" ? "Hospital Alemán" : ws === "ws-francisco" ? "Hospital Francisco" : "Hospital Blanco";
  const WS_SLUG  = ws === "ws-aleman" ? "HOSPITALALEMAN" : ws === "ws-francisco" ? "HOSPITALFRANCISCO" : "HOSPITALBLANCO";

  // ── Ensure workspace ──
  await db(
    supabaseAdmin.from("workspaces").upsert({ id: ws, name: WS_NAME, slug: WS_SLUG }, { onConflict: "id", ignoreDuplicates: true }),
  );

  // ── Medicines definition per hospital ──
  type MedDef = { key: string; name: string; ing: string; val: number; unit: string; form: string; price: number };

  const aleMeds: MedDef[] = [
    { key: "01", name: "Paracetamol",  ing: "Paracetamol",  val: 500,  unit: "mg",  form: "Comprimido", price: 850 },
    { key: "02", name: "Ibuprofeno",   ing: "Ibuprofeno",   val: 400,  unit: "mg",  form: "Comprimido", price: 1200 },
    { key: "03", name: "Amoxicilina",  ing: "Amoxicilina",  val: 875,  unit: "mg",  form: "Cápsula",    price: 2500 },
    { key: "04", name: "Omeprazol",    ing: "Omeprazol",    val: 20,   unit: "mg",  form: "Cápsula",    price: 1500 },
    { key: "05", name: "Salbutamol",   ing: "Salbutamol",   val: 100,  unit: "mcg", form: "Aerosol",    price: 3200 },
    { key: "06", name: "Enalapril",    ing: "Enalapril",    val: 10,   unit: "mg",  form: "Comprimido", price: 600 },
    { key: "07", name: "Metformina",   ing: "Metformina",   val: 850,  unit: "mg",  form: "Comprimido", price: 900 },
    { key: "08", name: "Diclofenac",   ing: "Diclofenac",   val: 75,   unit: "mg",  form: "Inyectable", price: 1800 },
    { key: "09", name: "Loratadina",   ing: "Loratadina",   val: 10,   unit: "mg",  form: "Comprimido", price: 500 },
    { key: "10", name: "Dexametasona", ing: "Dexametasona", val: 8,    unit: "mg",  form: "Comprimido", price: 700 },
    { key: "11", name: "Atorvastatina",ing: "Atorvastatina",val: 20,   unit: "mg",  form: "Comprimido", price: 1500 },
    { key: "12", name: "Losartán",     ing: "Losartán",     val: 50,   unit: "mg",  form: "Comprimido", price: 800 },
    { key: "13", name: "Ceftriaxona",  ing: "Ceftriaxona",  val: 1000, unit: "mg",  form: "Inyectable", price: 4500 },
    { key: "14", name: "Heparina",     ing: "Heparina",     val: 5000, unit: "ml",  form: "Inyectable", price: 6000 },
    { key: "15", name: "Solución NaCl",ing: "Cloruro de sodio", val: 900, unit: "mg", form: "Solución", price: 300 },
  ];

  const fcoMeds: MedDef[] = [
    { key: "01", name: "Paracetamol",  ing: "Paracetamol",  val: 500,  unit: "mg",  form: "Comprimido", price: 850 },
    { key: "02", name: "Ibuprofeno",   ing: "Ibuprofeno",   val: 400,  unit: "mg",  form: "Comprimido", price: 1200 },
    { key: "03", name: "Amoxicilina",  ing: "Amoxicilina",  val: 875,  unit: "mg",  form: "Cápsula",    price: 2500 },
    { key: "04", name: "Omeprazol",    ing: "Omeprazol",    val: 20,   unit: "mg",  form: "Cápsula",    price: 1500 },
    { key: "05", name: "Salbutamol",   ing: "Salbutamol",   val: 100,  unit: "mcg", form: "Aerosol",    price: 3200 },
    { key: "06", name: "Clonazepam",   ing: "Clonazepam",   val: 2,    unit: "mg",  form: "Comprimido", price: 400 },
    { key: "07", name: "Metformina",   ing: "Metformina",   val: 850,  unit: "mg",  form: "Comprimido", price: 900 },
    { key: "08", name: "Diclofenac",   ing: "Diclofenac",   val: 75,   unit: "mg",  form: "Inyectable", price: 1800 },
    { key: "09", name: "Loratadina",   ing: "Loratadina",   val: 10,   unit: "mg",  form: "Comprimido", price: 500 },
    { key: "10", name: "Dexametasona", ing: "Dexametasona", val: 8,    unit: "mg",  form: "Comprimido", price: 700 },
    { key: "11", name: "Atorvastatina",ing: "Atorvastatina",val: 20,   unit: "mg",  form: "Comprimido", price: 1500 },
    { key: "12", name: "Losartán",     ing: "Losartán",     val: 50,   unit: "mg",  form: "Comprimido", price: 800 },
    { key: "13", name: "Ceftriaxona",  ing: "Ceftriaxona",  val: 1000, unit: "mg",  form: "Inyectable", price: 4500 },
    { key: "14", name: "Heparina",     ing: "Heparina",     val: 5000, unit: "ml",  form: "Inyectable", price: 6000 },
    { key: "15", name: "Solución NaCl",ing: "Cloruro de sodio", val: 900, unit: "mg", form: "Solución", price: 300 },
  ];

  const blaMeds: MedDef[] = [
    { key: "01", name: "Paracetamol", ing: "Paracetamol", val: 500,  unit: "mg",  form: "Comprimido", price: 850 },
    { key: "02", name: "Ibuprofeno",  ing: "Ibuprofeno",  val: 400,  unit: "mg",  form: "Comprimido", price: 1200 },
    { key: "03", name: "Amoxicilina", ing: "Amoxicilina", val: 875,  unit: "mg",  form: "Cápsula",    price: 2500 },
    { key: "04", name: "Omeprazol",   ing: "Omeprazol",   val: 20,   unit: "mg",  form: "Cápsula",    price: 1500 },
    { key: "05", name: "Salbutamol",  ing: "Salbutamol",  val: 100,  unit: "mcg", form: "Aerosol",    price: 3200 },
  ];

  const medsMap: Record<string, MedDef[]> = { "ws-aleman": aleMeds, "ws-francisco": fcoMeds, "ws-blanco": blaMeds };
  const meds = medsMap[ws];

  const medId = (key: string) => `med-${PREFIX}-${key}`;

  // ── Ensure warehouses ──
  await db(
    supabaseAdmin.from("warehouses").upsert([
      { id: WH_CENTRAL, workspace_id: ws, name: "Depósito Central", type: "central", unit: WS_NAME },
      { id: WH_INTERNA, workspace_id: ws, name: "Farmacia Interna",  type: "interna", unit: WS_NAME },
      { id: WH_VENTAS,  workspace_id: ws, name: "Farmacia Ventas",   type: "ventas",  unit: WS_NAME },
    ], { onConflict: "id", ignoreDuplicates: true }),
  );

  // ── Ensure users (each hospital gets at least admin + tecnico) ──
  const users: Record<string, { id: string; workspace_id: string; name: string; email: string; role: string }[]> = {
    "ws-aleman": [
      { id: "u-admin-ale", workspace_id: "ws-aleman", name: "Admin Demo",     email: "hospitalalemanadmin@user.com",  role: "admin" },
      { id: "u-ventas-ale",workspace_id: "ws-aleman", name: "María Pérez",    email: "hospitalalemanventas@user.com", role: "ventas" },
      { id: "u-doctor-ale",workspace_id: "ws-aleman", name: "Doctor Demo",    email: "hospitalalemandoctor@user.com", role: "doctor" },
      { id: "u-tec-ale",   workspace_id: "ws-aleman", name: "Luis Sosa",      email: "hospitalalemantecnico@user.com",role: "tecnico" },
    ],
    "ws-francisco": [
      { id: "u-admin-fco", workspace_id: "ws-francisco", name: "Admin Demo",       email: "hospitalfranciscoadmin@user.com",  role: "admin" },
      { id: "u-ventas-fco",workspace_id: "ws-francisco", name: "Carlos Ruiz",      email: "hospitalfranciscoventas@user.com", role: "ventas" },
      { id: "u-doctor-fco",workspace_id: "ws-francisco", name: "Doctor Demo",      email: "hospitalfranciscodoctor@user.com", role: "doctor" },
      { id: "u-tec-fco",   workspace_id: "ws-francisco", name: "Patricia Vega",    email: "hospitalfranciscotecnico@user.com",role: "tecnico" },
    ],
    "ws-blanco": [
      { id: "u-admin-bla", workspace_id: "ws-blanco", name: "Admin Blanco",  email: "hospitalblancopadmin@user.com",  role: "admin" },
      { id: "u-tec-bla",   workspace_id: "ws-blanco", name: "Téc. Blanco",   email: "hospitalblaocotecnico@user.com", role: "tecnico" },
    ],
  };

  // Remove existing users for this workspace before re-inserting
  const existingUserIds = await db<{ id: string }[]>(
    supabaseAdmin.from("workspace_users").select("id").eq("workspace_id", ws),
  );
  const existingIdList = existingUserIds.map((r) => r.id);
  if (existingIdList.length > 0) {
    await db(supabaseAdmin.from("workspace_user_warehouses").delete().in("user_id", existingIdList));
    await db(supabaseAdmin.from("workspace_users").delete().in("id", existingIdList));
  }

  for (const u of users[ws]) {
    await db(
      supabaseAdmin.from("workspace_users").upsert(u, { onConflict: "id", ignoreDuplicates: true }),
    );
  }

  // ── Ensure medications ──
  for (const m of meds) {
    await db(
      supabaseAdmin.from("medications").upsert({
        id: medId(m.key),
        workspace_id: ws,
        name: m.name,
        active_ingredient: m.ing,
        concentration_value: m.val,
        concentration_unit: m.unit,
        form: m.form,
        sale_price: m.price,
        sale_enabled: m.key <= "12" || (PREFIX === "ale" && m.key === "13"),
      }, { onConflict: "id", ignoreDuplicates: true }),
    );
  }

  // ── Clear existing batches for this workspace's warehouses ──
  await db(supabaseAdmin.from("batches").delete().eq("warehouse_id", WH_CENTRAL));
  await db(supabaseAdmin.from("batches").delete().eq("warehouse_id", WH_INTERNA));
  await db(supabaseAdmin.from("batches").delete().eq("warehouse_id", WH_VENTAS));

  // ── Clear movement-related data for all workspaces ──
  await db(supabaseAdmin.from("movements").delete().eq("workspace_id", ws));
  await db(supabaseAdmin.from("dispensations").delete().eq("workspace_id", ws));
  await db(supabaseAdmin.from("sales").delete().eq("workspace_id", ws));
  await db(supabaseAdmin.from("medication_orders").delete().eq("workspace_id", ws));
  await db(supabaseAdmin.from("transfer_requests").delete().eq("workspace_id", ws));

  // ── Insert batches ──
  type BatchRow = { id: string; medication_id: string; warehouse_id: string; lot: string; expiry_days: number; quantity: number };

  const DAY = 86400000;

  function batchRows(rows: BatchRow[]) {
    for (const r of rows) {
      const expiry = new Date(Date.now() + r.expiry_days * DAY).toISOString();
      db(supabaseAdmin.from("batches").insert({
        id: r.id, medication_id: r.medication_id, warehouse_id: r.warehouse_id,
        lot: r.lot, expiry, quantity: r.quantity,
      })).catch(() => {}); // ignore conflicts
    }
  }

  // ─────────────────────────────────────────────
  // ALEMÁN batches
  // ─────────────────────────────────────────────
  if (ws === "ws-aleman") {
    batchRows([
      // Central
      { id: "b23-ale-c-01",  medication_id: medId("01"), warehouse_id: WH_CENTRAL, lot: "A26-C-001",  expiry_days: 365, quantity: 2600 },
      { id: "b23-ale-c-02",  medication_id: medId("02"), warehouse_id: WH_CENTRAL, lot: "A26-C-002",  expiry_days: 420, quantity: 1900 },
      { id: "b23-ale-c-03",  medication_id: medId("03"), warehouse_id: WH_CENTRAL, lot: "A26-C-003",  expiry_days: 300, quantity: 1500 },
      { id: "b23-ale-c-04",  medication_id: medId("04"), warehouse_id: WH_CENTRAL, lot: "A26-C-004",  expiry_days: 480, quantity: 1520 },
      { id: "b23-ale-c-05",  medication_id: medId("05"), warehouse_id: WH_CENTRAL, lot: "A26-C-005",  expiry_days: 240, quantity:  770 },
      { id: "b23-ale-c-06",  medication_id: medId("06"), warehouse_id: WH_CENTRAL, lot: "A26-C-006",  expiry_days: 400, quantity:  920 },
      { id: "b23-ale-c-07",  medication_id: medId("07"), warehouse_id: WH_CENTRAL, lot: "A26-C-007",  expiry_days: 360, quantity: 2230 },
      { id: "b23-ale-c-08",  medication_id: medId("08"), warehouse_id: WH_CENTRAL, lot: "A26-C-008",  expiry_days: 280, quantity:  680 },
      { id: "b23-ale-c-09",  medication_id: medId("09"), warehouse_id: WH_CENTRAL, lot: "A26-C-009",  expiry_days: 540, quantity:  820 },
      { id: "b23-ale-c-10",  medication_id: medId("10"), warehouse_id: WH_CENTRAL, lot: "A26-C-010",  expiry_days: 180, quantity:  480 },
      { id: "b23-ale-c-11",  medication_id: medId("11"), warehouse_id: WH_CENTRAL, lot: "A26-C-011",  expiry_days: 420, quantity:  690 },
      { id: "b23-ale-c-12",  medication_id: medId("12"), warehouse_id: WH_CENTRAL, lot: "A26-C-012",  expiry_days: 380, quantity:  760 },
      { id: "b23-ale-c-13",  medication_id: medId("13"), warehouse_id: WH_CENTRAL, lot: "A26-C-013",  expiry_days: 120, quantity:  420 },
      { id: "b23-ale-c-14",  medication_id: medId("14"), warehouse_id: WH_CENTRAL, lot: "A26-C-014",  expiry_days: 90,  quantity:  280 },
      { id: "b23-ale-c-15",  medication_id: medId("15"), warehouse_id: WH_CENTRAL, lot: "A26-C-015",  expiry_days: 60,  quantity: 8056 },
      // Central extra lots
      { id: "b23-ale-c-x1",  medication_id: medId("01"), warehouse_id: WH_CENTRAL, lot: "A26-C-001B", expiry_days: 18,  quantity:  200 },
      { id: "b23-ale-c-x2",  medication_id: medId("13"), warehouse_id: WH_CENTRAL, lot: "A26-C-013B", expiry_days: -5,  quantity:   45 },
      { id: "b23-ale-c-x3",  medication_id: medId("14"), warehouse_id: WH_CENTRAL, lot: "A26-C-014B", expiry_days: 8,   quantity:   30 },
      { id: "b23-ale-c-x4",  medication_id: medId("05"), warehouse_id: WH_CENTRAL, lot: "A26-C-005B", expiry_days: 22,  quantity:  130 },
      // Interna
      { id: "b23-ale-i-01",  medication_id: medId("01"), warehouse_id: WH_INTERNA, lot: "A26-I-001",  expiry_days: 200, quantity:  600 },
      { id: "b23-ale-i-02",  medication_id: medId("02"), warehouse_id: WH_INTERNA, lot: "A26-I-002",  expiry_days: 230, quantity:  440 },
      { id: "b23-ale-i-03",  medication_id: medId("03"), warehouse_id: WH_INTERNA, lot: "A26-I-003",  expiry_days: 150, quantity:  330 },
      { id: "b23-ale-i-04",  medication_id: medId("04"), warehouse_id: WH_INTERNA, lot: "A26-I-004",  expiry_days: 260, quantity:  340 },
      { id: "b23-ale-i-05",  medication_id: medId("05"), warehouse_id: WH_INTERNA, lot: "A26-I-005",  expiry_days: 120, quantity:  170 },
      { id: "b23-ale-i-06",  medication_id: medId("06"), warehouse_id: WH_INTERNA, lot: "A26-I-006",  expiry_days: 200, quantity:  180 },
      { id: "b23-ale-i-07",  medication_id: medId("07"), warehouse_id: WH_INTERNA, lot: "A26-I-007",  expiry_days: 190, quantity:  500 },
      { id: "b23-ale-i-08",  medication_id: medId("08"), warehouse_id: WH_INTERNA, lot: "A26-I-008",  expiry_days: 140, quantity:  135 },
      { id: "b23-ale-i-09",  medication_id: medId("09"), warehouse_id: WH_INTERNA, lot: "A26-I-009",  expiry_days: 280, quantity:  160 },
      { id: "b23-ale-i-10",  medication_id: medId("10"), warehouse_id: WH_INTERNA, lot: "A26-I-010",  expiry_days: 90,  quantity:   95 },
      { id: "b23-ale-i-11",  medication_id: medId("11"), warehouse_id: WH_INTERNA, lot: "A26-I-011",  expiry_days: 210, quantity:  135 },
      { id: "b23-ale-i-12",  medication_id: medId("12"), warehouse_id: WH_INTERNA, lot: "A26-I-012",  expiry_days: 195, quantity:  150 },
      { id: "b23-ale-i-13",  medication_id: medId("13"), warehouse_id: WH_INTERNA, lot: "A26-I-013",  expiry_days: 60,  quantity:   85 },
      { id: "b23-ale-i-14",  medication_id: medId("14"), warehouse_id: WH_INTERNA, lot: "A26-I-014",  expiry_days: 45,  quantity:   55 },
      { id: "b23-ale-i-15",  medication_id: medId("15"), warehouse_id: WH_INTERNA, lot: "A26-I-015",  expiry_days: 30,  quantity: 2400 },
      // Ventas
      { id: "b23-ale-v-01",  medication_id: medId("01"), warehouse_id: WH_VENTAS,  lot: "A26-V-001",  expiry_days: 180, quantity:  200 },
      { id: "b23-ale-v-02",  medication_id: medId("02"), warehouse_id: WH_VENTAS,  lot: "A26-V-002",  expiry_days: 210, quantity:  160 },
      { id: "b23-ale-v-03",  medication_id: medId("03"), warehouse_id: WH_VENTAS,  lot: "A26-V-003",  expiry_days: 120, quantity:  120 },
      { id: "b23-ale-v-04",  medication_id: medId("04"), warehouse_id: WH_VENTAS,  lot: "A26-V-004",  expiry_days: 240, quantity:  140 },
      { id: "b23-ale-v-05",  medication_id: medId("05"), warehouse_id: WH_VENTAS,  lot: "A26-V-005",  expiry_days: 90,  quantity:   60 },
      { id: "b23-ale-v-06",  medication_id: medId("06"), warehouse_id: WH_VENTAS,  lot: "A26-V-006",  expiry_days: 180, quantity:   70 },
      { id: "b23-ale-v-07",  medication_id: medId("07"), warehouse_id: WH_VENTAS,  lot: "A26-V-007",  expiry_days: 160, quantity:  170 },
      { id: "b23-ale-v-08",  medication_id: medId("08"), warehouse_id: WH_VENTAS,  lot: "A26-V-008",  expiry_days: 100, quantity:   55 },
      { id: "b23-ale-v-09",  medication_id: medId("09"), warehouse_id: WH_VENTAS,  lot: "A26-V-009",  expiry_days: 200, quantity:   65 },
      { id: "b23-ale-v-10",  medication_id: medId("10"), warehouse_id: WH_VENTAS,  lot: "A26-V-010",  expiry_days: 70,  quantity:   40 },
      { id: "b23-ale-v-11",  medication_id: medId("11"), warehouse_id: WH_VENTAS,  lot: "A26-V-011",  expiry_days: 190, quantity:   55 },
      { id: "b23-ale-v-12",  medication_id: medId("12"), warehouse_id: WH_VENTAS,  lot: "A26-V-012",  expiry_days: 170, quantity:   60 },
      { id: "b23-ale-v-13",  medication_id: medId("13"), warehouse_id: WH_VENTAS,  lot: "A26-V-013",  expiry_days: 50,  quantity:   35 },
    ]);
  }

  // ─────────────────────────────────────────────
  // FRANCISCO batches
  // ─────────────────────────────────────────────
  if (ws === "ws-francisco") {
    batchRows([
      // Central
      { id: "b23-fco-c-01",  medication_id: medId("01"), warehouse_id: WH_CENTRAL, lot: "F26-C-001",  expiry_days: 180, quantity: 570 },
      { id: "b23-fco-c-02",  medication_id: medId("02"), warehouse_id: WH_CENTRAL, lot: "F26-C-002",  expiry_days: 200, quantity: 410 },
      { id: "b23-fco-c-03",  medication_id: medId("03"), warehouse_id: WH_CENTRAL, lot: "F26-C-003",  expiry_days: 120, quantity: 245 },
      { id: "b23-fco-c-04",  medication_id: medId("04"), warehouse_id: WH_CENTRAL, lot: "F26-C-004",  expiry_days: 240, quantity: 340 },
      { id: "b23-fco-c-05",  medication_id: medId("05"), warehouse_id: WH_CENTRAL, lot: "F26-C-005",  expiry_days: 90,  quantity: 165 },
      { id: "b23-fco-c-06",  medication_id: medId("06"), warehouse_id: WH_CENTRAL, lot: "F26-C-006",  expiry_days: 300, quantity: 280 },
      { id: "b23-fco-c-07",  medication_id: medId("07"), warehouse_id: WH_CENTRAL, lot: "F26-C-007",  expiry_days: 160, quantity: 380 },
      { id: "b23-fco-c-08",  medication_id: medId("08"), warehouse_id: WH_CENTRAL, lot: "F26-C-008",  expiry_days: 140, quantity: 180 },
      { id: "b23-fco-c-09",  medication_id: medId("09"), warehouse_id: WH_CENTRAL, lot: "F26-C-009",  expiry_days: 360, quantity: 220 },
      { id: "b23-fco-c-10",  medication_id: medId("10"), warehouse_id: WH_CENTRAL, lot: "F26-C-010",  expiry_days: 280, quantity: 350 },
      { id: "b23-fco-c-11",  medication_id: medId("11"), warehouse_id: WH_CENTRAL, lot: "F26-C-011",  expiry_days: 320, quantity: 180 },
      { id: "b23-fco-c-12",  medication_id: medId("12"), warehouse_id: WH_CENTRAL, lot: "F26-C-012",  expiry_days: 240, quantity: 160 },
      { id: "b23-fco-c-13",  medication_id: medId("13"), warehouse_id: WH_CENTRAL, lot: "F26-C-013",  expiry_days: 180, quantity:  95 },
      { id: "b23-fco-c-14",  medication_id: medId("14"), warehouse_id: WH_CENTRAL, lot: "F26-C-014",  expiry_days: 120, quantity:  65 },
      { id: "b23-fco-c-15",  medication_id: medId("15"), warehouse_id: WH_CENTRAL, lot: "F26-C-015",  expiry_days: 45,  quantity: 1200 },
      // Central extra lots
      { id: "b23-fco-c-x1",  medication_id: medId("03"), warehouse_id: WH_CENTRAL, lot: "F26-C-003B", expiry_days: 12,  quantity:  15 },
      { id: "b23-fco-c-x2",  medication_id: medId("15"), warehouse_id: WH_CENTRAL, lot: "F26-C-015B", expiry_days: -3,  quantity:  80 },
      // Interna
      { id: "b23-fco-i-01",  medication_id: medId("01"), warehouse_id: WH_INTERNA, lot: "F26-I-001",  expiry_days: 90,  quantity:  20 },
      { id: "b23-fco-i-02",  medication_id: medId("02"), warehouse_id: WH_INTERNA, lot: "F26-I-002",  expiry_days: 100, quantity:  20 },
      { id: "b23-fco-i-03",  medication_id: medId("03"), warehouse_id: WH_INTERNA, lot: "F26-I-003",  expiry_days: 60,  quantity:  18 },
      { id: "b23-fco-i-04",  medication_id: medId("04"), warehouse_id: WH_INTERNA, lot: "F26-I-004",  expiry_days: 120, quantity:  22 },
      { id: "b23-fco-i-05",  medication_id: medId("05"), warehouse_id: WH_INTERNA, lot: "F26-I-005",  expiry_days: 45,  quantity:  12 },
      { id: "b23-fco-i-06",  medication_id: medId("06"), warehouse_id: WH_INTERNA, lot: "F26-I-006",  expiry_days: 150, quantity:  55 },
      { id: "b23-fco-i-07",  medication_id: medId("07"), warehouse_id: WH_INTERNA, lot: "F26-I-007",  expiry_days: 80,  quantity:  15 },
      { id: "b23-fco-i-08",  medication_id: medId("08"), warehouse_id: WH_INTERNA, lot: "F26-I-008",  expiry_days: 70,  quantity:  35 },
      { id: "b23-fco-i-09",  medication_id: medId("09"), warehouse_id: WH_INTERNA, lot: "F26-I-009",  expiry_days: 180, quantity:  40 },
      { id: "b23-fco-i-10",  medication_id: medId("10"), warehouse_id: WH_INTERNA, lot: "F26-I-010",  expiry_days: 130, quantity:  70 },
      { id: "b23-fco-i-11",  medication_id: medId("11"), warehouse_id: WH_INTERNA, lot: "F26-I-011",  expiry_days: 160, quantity:  35 },
      { id: "b23-fco-i-12",  medication_id: medId("12"), warehouse_id: WH_INTERNA, lot: "F26-I-012",  expiry_days: 120, quantity:  30 },
      { id: "b23-fco-i-13",  medication_id: medId("13"), warehouse_id: WH_INTERNA, lot: "F26-I-013",  expiry_days: 90,  quantity:  20 },
      { id: "b23-fco-i-14",  medication_id: medId("14"), warehouse_id: WH_INTERNA, lot: "F26-I-014",  expiry_days: 60,  quantity:  12 },
      { id: "b23-fco-i-15",  medication_id: medId("15"), warehouse_id: WH_INTERNA, lot: "F26-I-015",  expiry_days: 20,  quantity: 180 },
      // Ventas
      { id: "b23-fco-v-01",  medication_id: medId("01"), warehouse_id: WH_VENTAS,  lot: "F26-V-001",  expiry_days: 60,  quantity:  10 },
      { id: "b23-fco-v-02",  medication_id: medId("02"), warehouse_id: WH_VENTAS,  lot: "F26-V-002",  expiry_days: 70,  quantity:  10 },
      { id: "b23-fco-v-03",  medication_id: medId("03"), warehouse_id: WH_VENTAS,  lot: "F26-V-003",  expiry_days: 40,  quantity:   7 },
      { id: "b23-fco-v-04",  medication_id: medId("04"), warehouse_id: WH_VENTAS,  lot: "F26-V-004",  expiry_days: 80,  quantity:   8 },
      { id: "b23-fco-v-05",  medication_id: medId("05"), warehouse_id: WH_VENTAS,  lot: "F26-V-005",  expiry_days: 30,  quantity:   3 },
      { id: "b23-fco-v-06",  medication_id: medId("06"), warehouse_id: WH_VENTAS,  lot: "F26-V-006",  expiry_days: 150, quantity:  35 },
      { id: "b23-fco-v-07",  medication_id: medId("07"), warehouse_id: WH_VENTAS,  lot: "F26-V-007",  expiry_days: 50,  quantity:   5 },
      { id: "b23-fco-v-08",  medication_id: medId("08"), warehouse_id: WH_VENTAS,  lot: "F26-V-008",  expiry_days: 60,  quantity:  25 },
      { id: "b23-fco-v-09",  medication_id: medId("09"), warehouse_id: WH_VENTAS,  lot: "F26-V-009",  expiry_days: 130, quantity:  30 },
      { id: "b23-fco-v-10",  medication_id: medId("10"), warehouse_id: WH_VENTAS,  lot: "F26-V-010",  expiry_days: 110, quantity:  50 },
      { id: "b23-fco-v-11",  medication_id: medId("11"), warehouse_id: WH_VENTAS,  lot: "F26-V-011",  expiry_days: 140, quantity:  25 },
      { id: "b23-fco-v-12",  medication_id: medId("12"), warehouse_id: WH_VENTAS,  lot: "F26-V-012",  expiry_days: 90,  quantity:  20 },
    ]);
  }

  // ─────────────────────────────────────────────
  // BLANCO batches
  // ─────────────────────────────────────────────
  if (ws === "ws-blanco") {
    batchRows([
      // Central
      { id: "b23-bla-c-01", medication_id: medId("01"), warehouse_id: WH_CENTRAL, lot: "B26-C-001", expiry_days: 30, quantity:  50 },
      { id: "b23-bla-c-02", medication_id: medId("02"), warehouse_id: WH_CENTRAL, lot: "B26-C-002", expiry_days: 45, quantity:  30 },
      { id: "b23-bla-c-03", medication_id: medId("03"), warehouse_id: WH_CENTRAL, lot: "B26-C-003", expiry_days: 20, quantity:   0 },
      { id: "b23-bla-c-04", medication_id: medId("04"), warehouse_id: WH_CENTRAL, lot: "B26-C-004", expiry_days: 60, quantity:  20 },
      { id: "b23-bla-c-05", medication_id: medId("05"), warehouse_id: WH_CENTRAL, lot: "B26-C-005", expiry_days: 15, quantity:  10 },
      // Interna
      { id: "b23-bla-i-01", medication_id: medId("01"), warehouse_id: WH_INTERNA, lot: "B26-I-001", expiry_days: 14, quantity:  12 },
      { id: "b23-bla-i-02", medication_id: medId("02"), warehouse_id: WH_INTERNA, lot: "B26-I-002", expiry_days: 10, quantity:   7 },
      { id: "b23-bla-i-03", medication_id: medId("03"), warehouse_id: WH_INTERNA, lot: "B26-I-003", expiry_days: 8,  quantity:   0 },
      { id: "b23-bla-i-04", medication_id: medId("04"), warehouse_id: WH_INTERNA, lot: "B26-I-004", expiry_days: 20, quantity:   8 },
      { id: "b23-bla-i-05", medication_id: medId("05"), warehouse_id: WH_INTERNA, lot: "B26-I-005", expiry_days: 5,  quantity:   4 },
      // Ventas
      { id: "b23-bla-v-01", medication_id: medId("01"), warehouse_id: WH_VENTAS,  lot: "B26-V-001", expiry_days: 30, quantity:   0 },
      { id: "b23-bla-v-02", medication_id: medId("02"), warehouse_id: WH_VENTAS,  lot: "B26-V-002", expiry_days: 30, quantity:   0 },
      { id: "b23-bla-v-03", medication_id: medId("03"), warehouse_id: WH_VENTAS,  lot: "B26-V-003", expiry_days: 30, quantity:   0 },
      { id: "b23-bla-v-04", medication_id: medId("04"), warehouse_id: WH_VENTAS,  lot: "B26-V-004", expiry_days: 30, quantity:   0 },
      { id: "b23-bla-v-05", medication_id: medId("05"), warehouse_id: WH_VENTAS,  lot: "B26-V-005", expiry_days: 30, quantity:   0 },
    ]);
  }

  // ─────────────────────────────────────────────
  // Stock config per workspace
  // ─────────────────────────────────────────────
  await db(supabaseAdmin.from("medication_stock_config").delete().eq("warehouse_id", WH_CENTRAL));
  await db(supabaseAdmin.from("medication_stock_config").delete().eq("warehouse_id", WH_INTERNA));
  await db(supabaseAdmin.from("medication_stock_config").delete().eq("warehouse_id", WH_VENTAS));

  type SC = { medKey: string; warehouse_id: string; min_stock: number; optimal_stock: number };

  function stockConfigs(rows: SC[]) {
    for (const r of rows) {
      db(supabaseAdmin.from("medication_stock_config").upsert({
        medication_id: medId(r.medKey), warehouse_id: r.warehouse_id, min_stock: r.min_stock, optimal_stock: r.optimal_stock,
      }, { onConflict: "medication_id,warehouse_id", ignoreDuplicates: true })).catch(() => {});
    }
  }

  if (ws === "ws-aleman") {
    stockConfigs([
      // Central
      { medKey:"01", warehouse_id: WH_CENTRAL, min_stock:1430, optimal_stock:2380 },
      { medKey:"02", warehouse_id: WH_CENTRAL, min_stock:1050, optimal_stock:1745 },
      { medKey:"03", warehouse_id: WH_CENTRAL, min_stock: 830, optimal_stock:1380 },
      { medKey:"04", warehouse_id: WH_CENTRAL, min_stock: 830, optimal_stock:1380 },
      { medKey:"05", warehouse_id: WH_CENTRAL, min_stock: 390, optimal_stock: 645 },
      { medKey:"06", warehouse_id: WH_CENTRAL, min_stock: 400, optimal_stock: 700 },
      { medKey:"07", warehouse_id: WH_CENTRAL, min_stock: 960, optimal_stock:1595 },
      { medKey:"08", warehouse_id: WH_CENTRAL, min_stock: 300, optimal_stock: 500 },
      { medKey:"09", warehouse_id: WH_CENTRAL, min_stock: 400, optimal_stock: 650 },
      { medKey:"10", warehouse_id: WH_CENTRAL, min_stock: 200, optimal_stock: 350 },
      { medKey:"11", warehouse_id: WH_CENTRAL, min_stock: 300, optimal_stock: 550 },
      { medKey:"12", warehouse_id: WH_CENTRAL, min_stock: 360, optimal_stock: 600 },
      { medKey:"13", warehouse_id: WH_CENTRAL, min_stock: 150, optimal_stock: 280 },
      { medKey:"14", warehouse_id: WH_CENTRAL, min_stock: 100, optimal_stock: 200 },
      { medKey:"15", warehouse_id: WH_CENTRAL, min_stock:8000, optimal_stock:15000 },
      // Interna
      { medKey:"01", warehouse_id: WH_INTERNA, min_stock:285, optimal_stock:475 },
      { medKey:"02", warehouse_id: WH_INTERNA, min_stock:210, optimal_stock:345 },
      { medKey:"03", warehouse_id: WH_INTERNA, min_stock:165, optimal_stock:280 },
      { medKey:"04", warehouse_id: WH_INTERNA, min_stock:165, optimal_stock:280 },
      { medKey:"05", warehouse_id: WH_INTERNA, min_stock: 78, optimal_stock:130 },
      { medKey:"06", warehouse_id: WH_INTERNA, min_stock: 80, optimal_stock:130 },
      { medKey:"07", warehouse_id: WH_INTERNA, min_stock:190, optimal_stock:320 },
      { medKey:"08", warehouse_id: WH_INTERNA, min_stock: 60, optimal_stock:100 },
      { medKey:"09", warehouse_id: WH_INTERNA, min_stock: 75, optimal_stock:130 },
      { medKey:"10", warehouse_id: WH_INTERNA, min_stock: 40, optimal_stock: 70 },
      { medKey:"11", warehouse_id: WH_INTERNA, min_stock: 60, optimal_stock:100 },
      { medKey:"12", warehouse_id: WH_INTERNA, min_stock: 70, optimal_stock:110 },
      { medKey:"13", warehouse_id: WH_INTERNA, min_stock: 35, optimal_stock: 60 },
      { medKey:"14", warehouse_id: WH_INTERNA, min_stock: 20, optimal_stock: 40 },
      { medKey:"15", warehouse_id: WH_INTERNA, min_stock:1000, optimal_stock:2000 },
      // Ventas
      { medKey:"01", warehouse_id: WH_VENTAS, min_stock: 85, optimal_stock:145 },
      { medKey:"02", warehouse_id: WH_VENTAS, min_stock: 67, optimal_stock:110 },
      { medKey:"03", warehouse_id: WH_VENTAS, min_stock: 50, optimal_stock: 90 },
      { medKey:"04", warehouse_id: WH_VENTAS, min_stock: 50, optimal_stock: 90 },
      { medKey:"05", warehouse_id: WH_VENTAS, min_stock: 25, optimal_stock: 45 },
      { medKey:"06", warehouse_id: WH_VENTAS, min_stock: 30, optimal_stock: 50 },
      { medKey:"07", warehouse_id: WH_VENTAS, min_stock: 65, optimal_stock:105 },
      { medKey:"08", warehouse_id: WH_VENTAS, min_stock: 25, optimal_stock: 40 },
      { medKey:"09", warehouse_id: WH_VENTAS, min_stock: 30, optimal_stock: 50 },
      { medKey:"10", warehouse_id: WH_VENTAS, min_stock: 15, optimal_stock: 30 },
      { medKey:"11", warehouse_id: WH_VENTAS, min_stock: 25, optimal_stock: 40 },
      { medKey:"12", warehouse_id: WH_VENTAS, min_stock: 25, optimal_stock: 45 },
      { medKey:"13", warehouse_id: WH_VENTAS, min_stock: 12, optimal_stock: 25 },
    ]);
  }

  if (ws === "ws-francisco") {
    stockConfigs([
      { medKey:"01", warehouse_id: WH_CENTRAL, min_stock:640, optimal_stock:1020 },
      { medKey:"02", warehouse_id: WH_CENTRAL, min_stock:510, optimal_stock:815 },
      { medKey:"03", warehouse_id: WH_CENTRAL, min_stock:320, optimal_stock:512 },
      { medKey:"04", warehouse_id: WH_CENTRAL, min_stock:440, optimal_stock:704 },
      { medKey:"05", warehouse_id: WH_CENTRAL, min_stock:240, optimal_stock:384 },
      { medKey:"06", warehouse_id: WH_CENTRAL, min_stock:120, optimal_stock:220 },
      { medKey:"07", warehouse_id: WH_CENTRAL, min_stock:600, optimal_stock:960 },
      { medKey:"08", warehouse_id: WH_CENTRAL, min_stock: 80, optimal_stock:140 },
      { medKey:"09", warehouse_id: WH_CENTRAL, min_stock: 90, optimal_stock:160 },
      { medKey:"10", warehouse_id: WH_CENTRAL, min_stock:150, optimal_stock:260 },
      { medKey:"11", warehouse_id: WH_CENTRAL, min_stock: 80, optimal_stock:140 },
      { medKey:"12", warehouse_id: WH_CENTRAL, min_stock: 70, optimal_stock:120 },
      { medKey:"13", warehouse_id: WH_CENTRAL, min_stock: 40, optimal_stock: 70 },
      { medKey:"14", warehouse_id: WH_CENTRAL, min_stock: 25, optimal_stock: 45 },
      { medKey:"15", warehouse_id: WH_CENTRAL, min_stock:500, optimal_stock: 900 },
      // Interna
      { medKey:"01", warehouse_id: WH_INTERNA, min_stock:120, optimal_stock:190 },
      { medKey:"02", warehouse_id: WH_INTERNA, min_stock:100, optimal_stock:160 },
      { medKey:"03", warehouse_id: WH_INTERNA, min_stock: 60, optimal_stock: 98 },
      { medKey:"04", warehouse_id: WH_INTERNA, min_stock: 85, optimal_stock:136 },
      { medKey:"05", warehouse_id: WH_INTERNA, min_stock: 45, optimal_stock: 72 },
      { medKey:"06", warehouse_id: WH_INTERNA, min_stock: 22, optimal_stock: 40 },
      { medKey:"07", warehouse_id: WH_INTERNA, min_stock:120, optimal_stock:192 },
      { medKey:"08", warehouse_id: WH_INTERNA, min_stock: 16, optimal_stock: 28 },
      { medKey:"09", warehouse_id: WH_INTERNA, min_stock: 18, optimal_stock: 30 },
      { medKey:"10", warehouse_id: WH_INTERNA, min_stock: 28, optimal_stock: 50 },
      { medKey:"11", warehouse_id: WH_INTERNA, min_stock: 16, optimal_stock: 28 },
      { medKey:"12", warehouse_id: WH_INTERNA, min_stock: 14, optimal_stock: 24 },
      { medKey:"13", warehouse_id: WH_INTERNA, min_stock:  8, optimal_stock: 14 },
      { medKey:"14", warehouse_id: WH_INTERNA, min_stock:  5, optimal_stock:  9 },
      { medKey:"15", warehouse_id: WH_INTERNA, min_stock: 80, optimal_stock:144 },
      // Ventas
      { medKey:"01", warehouse_id: WH_VENTAS, min_stock: 40, optimal_stock: 70 },
      { medKey:"02", warehouse_id: WH_VENTAS, min_stock: 30, optimal_stock: 55 },
      { medKey:"03", warehouse_id: WH_VENTAS, min_stock: 20, optimal_stock: 32 },
      { medKey:"04", warehouse_id: WH_VENTAS, min_stock: 25, optimal_stock: 40 },
      { medKey:"05", warehouse_id: WH_VENTAS, min_stock: 15, optimal_stock: 24 },
      { medKey:"06", warehouse_id: WH_VENTAS, min_stock: 14, optimal_stock: 26 },
      { medKey:"07", warehouse_id: WH_VENTAS, min_stock: 30, optimal_stock: 48 },
      { medKey:"08", warehouse_id: WH_VENTAS, min_stock: 10, optimal_stock: 18 },
      { medKey:"09", warehouse_id: WH_VENTAS, min_stock: 12, optimal_stock: 20 },
      { medKey:"10", warehouse_id: WH_VENTAS, min_stock: 22, optimal_stock: 38 },
      { medKey:"11", warehouse_id: WH_VENTAS, min_stock: 10, optimal_stock: 18 },
      { medKey:"12", warehouse_id: WH_VENTAS, min_stock:  8, optimal_stock: 14 },
    ]);
  }

  if (ws === "ws-blanco") {
    stockConfigs([
      { medKey:"01", warehouse_id: WH_CENTRAL, min_stock:510, optimal_stock:765 },
      { medKey:"02", warehouse_id: WH_CENTRAL, min_stock:310, optimal_stock:464 },
      { medKey:"03", warehouse_id: WH_CENTRAL, min_stock:224, optimal_stock:336 },
      { medKey:"04", warehouse_id: WH_CENTRAL, min_stock:245, optimal_stock:368 },
      { medKey:"05", warehouse_id: WH_CENTRAL, min_stock:187, optimal_stock:280 },
      // Interna
      { medKey:"01", warehouse_id: WH_INTERNA, min_stock:100, optimal_stock:150 },
      { medKey:"02", warehouse_id: WH_INTERNA, min_stock: 60, optimal_stock: 90 },
      { medKey:"03", warehouse_id: WH_INTERNA, min_stock: 44, optimal_stock: 66 },
      { medKey:"04", warehouse_id: WH_INTERNA, min_stock: 48, optimal_stock: 72 },
      { medKey:"05", warehouse_id: WH_INTERNA, min_stock: 37, optimal_stock: 55 },
      // Ventas
      { medKey:"01", warehouse_id: WH_VENTAS, min_stock: 30, optimal_stock: 45 },
      { medKey:"02", warehouse_id: WH_VENTAS, min_stock: 17, optimal_stock: 26 },
      { medKey:"03", warehouse_id: WH_VENTAS, min_stock: 12, optimal_stock: 18 },
      { medKey:"04", warehouse_id: WH_VENTAS, min_stock: 15, optimal_stock: 22 },
      { medKey:"05", warehouse_id: WH_VENTAS, min_stock: 10, optimal_stock: 15 },
    ]);
  }

  // ─────────────────────────────────────────────
  // Warehouse capacities
  // ─────────────────────────────────────────────
  const capMap: Record<string, { max: number }> = {
    "ws-aleman":    { max: 28000 },
    "ws-francisco": { max: 5000 },
    "ws-blanco":    { max: 3000 },
  };
  const internaCap: Record<string, number> = { "ws-aleman": 8000, "ws-francisco": 1000, "ws-blanco": 1500 };
  const ventasCap: Record<string, number>  = { "ws-aleman": 2000, "ws-francisco": 800,  "ws-blanco": 500 };

  await db(supabaseAdmin.from("warehouses").update({ max_capacity: capMap[ws].max }).eq("id", WH_CENTRAL));
  await db(supabaseAdmin.from("warehouses").update({ max_capacity: internaCap[ws] }).eq("id", WH_INTERNA));
  await db(supabaseAdmin.from("warehouses").update({ max_capacity: ventasCap[ws] }).eq("id", WH_VENTAS));

  // Recalculate volume = sum of batch quantities per warehouse
  for (const whId of [WH_CENTRAL, WH_INTERNA, WH_VENTAS]) {
    const batchRows = await db<{ quantity: number }[]>(
      supabaseAdmin.from("batches").select("quantity").eq("warehouse_id", whId),
    );
    const volume = batchRows.reduce((acc, b) => acc + (b.quantity ?? 0), 0);
    await db(supabaseAdmin.from("warehouses").update({ volume }).eq("id", whId));
  }

  // ── Generate dummy movements for all known demo workspaces ──
  await generateDummyMovements(ws, PREFIX, meds, medId, WH_CENTRAL, WH_INTERNA, WH_VENTAS);
}

// ─── Movement generation for demo workspaces ────────────────────────

async function generateDummyMovements(
  ws: string,
  PREFIX: string,
  meds: { key: string; name: string }[],
  medId: (key: string) => string,
  WH_CENTRAL: string,
  WH_INTERNA: string,
  WH_VENTAS: string,
) {
  const DAY = 86400000;
  const now = Date.now();

  const userMap: Record<string, { admin: string; ventas: string; doctor: string; tecnico: string }> = {
    "ws-aleman":    { admin: "Admin Demo",    ventas: "María Pérez",  doctor: "Doctor Demo",    tecnico: "Luis Sosa" },
    "ws-francisco": { admin: "Admin Demo",    ventas: "Carlos Ruiz",  doctor: "Doctor Demo",    tecnico: "Patricia Vega" },
    "ws-blanco":    { admin: "Admin Blanco",  ventas: "Admin Blanco", doctor: "Admin Blanco",   tecnico: "Téc. Blanco" },
  };
  const u = userMap[ws] ?? userMap["ws-blanco"];

  const medKeys = meds.map((m) => m.key);
  if (medKeys.length === 0) return;

  const patients = [
    "Juan Pérez", "María García", "Carlos López", "Ana Martínez", "Pedro Rodríguez",
    "Laura Sánchez", "Diego Fernández", "Sofía González", "Miguel Ruiz", "Lucía Díaz",
    "Pablo Gómez", "Valentina Moreno", "Andrés Torres", "Camila Vargas", "Javier Castro",
    "Rocío Medina", "Fernando Silva", "Gabriela Ríos", "Hugo Paz", "Clara Vega",
  ];
  const doctors = [u.doctor, "Dr. López", "Dra. Medina", "Dr. Rivas", "Dra. Peralta"];
  const rooms = ["101A", "102B", "201A", "202B", "301A", "302B", "UCI-1", "UCI-2", "Pediatría", "Cirugía"];

  const movements: {
    id: string; workspace_id: string; type: string; medication_id: string;
    warehouse_id: string; quantity: number; user_name: string; reason: string; date: string;
  }[] = [];
  const dispensations: {
    id: string; workspace_id: string; medication_id: string; warehouse_id: string;
    quantity: number; doctor: string; patient: string; room: string; treatment: string; date: string;
  }[] = [];
  const sales: {
    id: string; workspace_id: string; medication_id: string; warehouse_id: string;
    quantity: number; price: number; cashier: string; date: string;
  }[] = [];
  const medOrders: {
    id: string; workspace_id: string; medication_id: string; warehouse_id: string;
    quantity: number; doctor: string; patient: string; room: string; reason: string;
    status: string; requested_at: string;
  }[] = [];
  const transfers: {
    id: string; workspace_id: string; transfer_code: string; medication_id: string;
    from_warehouse_id: string; to_warehouse_id: string; quantity: number;
    status: string; requested_by: string; date: string;
  }[] = [];

  let seq = 0;

  for (let d = 1; d <= 30; d++) {
    const dayOfWeek = new Date(now - d * DAY).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const wkFactor = isWeekend ? 0.3 : 1;

    const baseDate = new Date(now - d * DAY);
    baseDate.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

    function rdate() {
      return new Date(baseDate.getTime() + Math.floor(Math.random() * 8) * 3600000).toISOString();
    }
    function mid() {
      return `dm-${PREFIX}-${String(++seq).padStart(4, "0")}`;
    }

    // Scale intensity by workspace size
    const scale = ws === "ws-aleman" ? 1 : ws === "ws-francisco" ? 0.7 : 0.4;

    // ── Consumptions from Central (daily egresos) ──
    const consumoCount = Math.max(1, Math.floor(Math.random() * 5 * wkFactor * scale) + 1);
    for (let i = 0; i < consumoCount; i++) {
      const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
      const qty = -(Math.floor(Math.random() * 12 * wkFactor) + 1);
      movements.push({
        id: mid(), workspace_id: ws, type: "egreso", medication_id: medId(mk),
        warehouse_id: WH_CENTRAL, quantity: qty, user_name: u.admin,
        reason: "Consumo interno", date: rdate(),
      });
    }

    // ── Dispensations from Interna ──
    const dispCount = ws === "ws-aleman"
      ? (Math.random() < 0.6 * wkFactor ? 1 : 0) + (Math.random() < 0.3 * wkFactor ? 1 : 0)
      : Math.random() < 0.4 * wkFactor * scale ? 1 : 0;
    for (let i = 0; i < dispCount; i++) {
      const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
      const qty = -(Math.floor(Math.random() * 6) + 1);
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const dt = rdate();
      movements.push({
        id: mid(), workspace_id: ws, type: "dispensacion", medication_id: medId(mk),
        warehouse_id: WH_INTERNA, quantity: qty, user_name: u.tecnico,
        reason: `Dispensación: ${patient}`, date: dt,
      });
      dispensations.push({
        id: mid(), workspace_id: ws, medication_id: medId(mk), warehouse_id: WH_INTERNA,
        quantity: -qty, doctor, patient, room, treatment: "Tratamiento indicado",
        date: dt,
      });
    }

    // ── Sales from Ventas ──
    if (Math.random() < 0.3 * wkFactor * scale) {
      const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const medPrice = meds.find((m) => m.key === mk);
      const price = (medPrice as any)?.price ?? 1000;
      const dt = rdate();
      movements.push({
        id: mid(), workspace_id: ws, type: "venta", medication_id: medId(mk),
        warehouse_id: WH_VENTAS, quantity: -qty, user_name: u.ventas,
        reason: "Venta al público", date: dt,
      });
      sales.push({
        id: mid(), workspace_id: ws, medication_id: medId(mk), warehouse_id: WH_VENTAS,
        quantity: qty, price: price * qty, cashier: u.ventas, date: dt,
      });
    }
  }

  // ── Periodic purchases (ingresos to Central every ~7 days) ──
  for (let d = 1; d <= 30; d += 7 + Math.floor(Math.random() * 3)) {
    const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
    const qty = Math.floor(Math.random() * 500 * (ws === "ws-aleman" ? 1 : ws === "ws-francisco" ? 0.6 : 0.3)) + 50;
    const dt = new Date(now - d * DAY);
    dt.setHours(9, Math.floor(Math.random() * 30));
    movements.push({
      id: `dm-${PREFIX}-p${d}`, workspace_id: ws, type: "ingreso", medication_id: medId(mk),
      warehouse_id: WH_CENTRAL, quantity: qty, user_name: u.admin,
      reason: `Compra OC-${Math.floor(Math.random() * 9000 + 1000)}`, date: dt.toISOString(),
    });
  }

  // ── Medication orders (every ~5-7 days) ──
  for (let d = 2; d <= 30; d += 5 + Math.floor(Math.random() * 4)) {
    const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
    const qty = Math.floor(Math.random() * 20) + 5;
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const doctor = doctors[Math.floor(Math.random() * doctors.length)];
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const dt = new Date(now - d * DAY);
    dt.setHours(10, Math.floor(Math.random() * 60));
    medOrders.push({
      id: `do-${PREFIX}-${d}`, workspace_id: ws, medication_id: medId(mk),
      warehouse_id: WH_INTERNA, quantity: qty, doctor, patient, room,
      reason: "Prescripción médica", status: "pendiente",
      requested_at: dt.toISOString(),
    });
  }

  // ── Transfer requests (every ~8-12 days) ──
  let transferSeq = 0;
  for (let d = 3; d <= 30; d += 8 + Math.floor(Math.random() * 6)) {
    const mk = medKeys[Math.floor(Math.random() * medKeys.length)];
    const qty = Math.floor(Math.random() * 30) + 5;
    const dt = new Date(now - d * DAY);
    dt.setHours(11, Math.floor(Math.random() * 60));
    transfers.push({
      id: `dt-${PREFIX}-${++transferSeq}`,
      workspace_id: ws,
      transfer_code: `T-${ws.slice(-3)}-${String(d).padStart(2, "0")}`,
      medication_id: medId(mk),
      from_warehouse_id: WH_CENTRAL,
      to_warehouse_id: WH_INTERNA,
      quantity: qty,
      status: Math.random() < 0.4 ? "solicitado" : Math.random() < 0.6 ? "despachado" : "recibido",
      requested_by: u.admin,
      date: dt.toISOString(),
    });
  }

  // ── Batch insert ──
  const batchInsert = async <T>(table: string, rows: T[]) => {
    if (rows.length === 0) return;
    // Insert in chunks of 50 to avoid Supabase payload limits
    for (let i = 0; i < rows.length; i += 50) {
      await db((supabaseAdmin.from(table) as any).insert(rows.slice(i, i + 50)));
    }
  };

  await batchInsert("movements", movements);
  await batchInsert("dispensations", dispensations);
  await batchInsert("sales", sales);
  await batchInsert("medication_orders", medOrders);
  await batchInsert("transfer_requests", transfers);
}

// ─── Generic seed for unknown workspaces ──────────────────────────────

async function seedGenericWorkspace(workspaceId: string, workspaceName: string) {
  const whCentralId = `wh-${workspaceId}-central`;
  const whInternaId = `wh-${workspaceId}-interna`;
  const whVentasId = `wh-${workspaceId}-ventas`;

  await db(
    supabaseAdmin.from("warehouses").upsert([
      { id: whCentralId, workspace_id: workspaceId, name: "Depósito Central", type: "central", unit: workspaceName },
      { id: whInternaId, workspace_id: workspaceId, name: "Farmacia Interna", type: "interna", unit: workspaceName },
      { id: whVentasId, workspace_id: workspaceId, name: "Farmacia Ventas", type: "ventas", unit: workspaceName },
    ], { onConflict: "id", ignoreDuplicates: true }),
  );

  const meds = [
    { key: "01", name: "Paracetamol", ing: "Paracetamol", val: 500, unit: "mg", form: "Comprimido", price: 850 },
    { key: "02", name: "Ibuprofeno", ing: "Ibuprofeno", val: 400, unit: "mg", form: "Comprimido", price: 1200 },
    { key: "03", name: "Amoxicilina", ing: "Amoxicilina", val: 875, unit: "mg", form: "Cápsula", price: 2500 },
    { key: "04", name: "Omeprazol", ing: "Omeprazol", val: 20, unit: "mg", form: "Cápsula", price: 1500 },
    { key: "05", name: "Salbutamol", ing: "Salbutamol", val: 100, unit: "mcg", form: "Aerosol", price: 3200 },
    { key: "06", name: "Enalapril", ing: "Enalapril", val: 10, unit: "mg", form: "Comprimido", price: 600 },
    { key: "07", name: "Metformina", ing: "Metformina", val: 850, unit: "mg", form: "Comprimido", price: 900 },
    { key: "08", name: "Diclofenac", ing: "Diclofenac", val: 75, unit: "mg", form: "Inyectable", price: 1800 },
  ];

  for (const m of meds) {
    const id = `med-${workspaceId}-${m.key}`;
    await db(
      supabaseAdmin.from("medications").upsert({
        id,
        workspace_id: workspaceId,
        name: m.name,
        active_ingredient: m.ing,
        concentration_value: m.val,
        concentration_unit: m.unit,
        form: m.form,
        sale_price: m.price,
        sale_enabled: true,
      }, { onConflict: "id", ignoreDuplicates: true }),
    );
  }

  for (const m of meds) {
    const medId = `med-${workspaceId}-${m.key}`;
    for (const [whId, whSuffix] of [[whCentralId, "C"], [whVentasId, "V"]] as const) {
      await db(
        supabaseAdmin.from("batches").insert({
          id: `b-${medId}-${whSuffix.toLowerCase()}-001`,
          medication_id: medId,
          warehouse_id: whId,
          lot: `LOT-${medId.slice(-4)}-${whSuffix}`,
          expiry: new Date(Date.now() + (whSuffix === "C" ? 180 : 120) * 86400000).toISOString(),
          quantity: Math.floor(Math.random() * 500) + 200,
        }),
      ).catch(() => {});
    }
  }

  for (const m of meds) {
    const medId = `med-${workspaceId}-${m.key}`;
    const baseMin = Math.floor(Math.random() * 100) + 50;
    const baseOpt = baseMin * 2;
    for (const [whId, factor] of [[whCentralId, 5], [whInternaId, 2], [whVentasId, 1]] as const) {
      await db(
        supabaseAdmin.from("medication_stock_config").upsert({
          medication_id: medId,
          warehouse_id: whId,
          min_stock: baseMin * factor,
          optimal_stock: baseOpt * factor,
        }, { onConflict: "medication_id,warehouse_id", ignoreDuplicates: true }),
      ).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  NUEVAS FUNCIONES ASISTENTE CON ACCIONES
// ─────────────────────────────────────────────────────────────

export async function addStockDirectly(data: {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  lot?: string;
  expiry?: string;
}): Promise<{ batchId: string }> {
  const med = await db<{ id: string; workspace_id: string }[]>(
    supabaseAdmin.from("medications").select("id, workspace_id").eq("id", data.medicationId).limit(1)
  );
  if (!med.length) throw new Error("Medicamento no encontrado");

  const wh = await db<{ id: string; workspace_id: string }[]>(
    supabaseAdmin.from("warehouses").select("id, workspace_id").eq("id", data.warehouseId).limit(1)
  );
  if (!wh.length) throw new Error("Depósito no encontrado");

  const lot = data.lot ?? `MEDI-${Date.now()}`;
  const expiry = data.expiry ?? new Date(Date.now() + 365 * 86400000).toISOString();

  const existing = await db<{ id: string; quantity: number }[]>(
    supabaseAdmin.from("batches")
      .select("id, quantity")
      .eq("medication_id", data.medicationId)
      .eq("warehouse_id", data.warehouseId)
      .eq("lot", lot)
      .limit(1)
  );

  let batchId: string;
  if (existing.length > 0) {
    batchId = existing[0].id;
    await db(
      supabaseAdmin.from("batches")
        .update({ quantity: existing[0].quantity + data.quantity })
        .eq("id", batchId)
    );
  } else {
    batchId = randomUUID();
    await db(
      supabaseAdmin.from("batches").insert({
        id: batchId,
        medication_id: data.medicationId,
        warehouse_id: data.warehouseId,
        lot,
        expiry,
        quantity: data.quantity,
      })
    );
  }

  await db(
    supabaseAdmin.from("movements").insert({
      id: randomUUID(),
      workspace_id: med[0].workspace_id,
      medication_id: data.medicationId,
      warehouse_id: data.warehouseId,
      type: "ingreso",
      quantity: data.quantity,
      user_name: "Asistente Medi",
      date: new Date().toISOString(),
      notes: "Ajuste directo de stock vía asistente",
    })
  );

  return { batchId };
}

export async function addStockWithPurchase(data: {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  lot?: string;
  expiry?: string;
  invoiceRef?: string;
  unitPrice?: number;
}): Promise<{ batchId: string }> {
  const result = await addStockDirectly({
    medicationId: data.medicationId,
    warehouseId: data.warehouseId,
    quantity: data.quantity,
    lot: data.lot,
    expiry: data.expiry,
  });

  const med = await db<{ workspace_id: string }[]>(
    supabaseAdmin.from("medications").select("workspace_id").eq("id", data.medicationId).limit(1)
  );

  await db(
    supabaseAdmin.from("movements").insert({
      id: randomUUID(),
      workspace_id: med[0]?.workspace_id ?? "",
      medication_id: data.medicationId,
      warehouse_id: data.warehouseId,
      type: "compra",
      quantity: data.quantity,
      user_name: "Asistente Medi",
      date: new Date().toISOString(),
      notes: data.invoiceRef
        ? `Compra registrada vía asistente. Ref: ${data.invoiceRef}`
        : "Compra registrada vía asistente",
    })
  );

  return result;
}

export interface AssistantFullSnapshot {
  workspaces: { id: string; name: string; slug: string }[];
  medications: { id: string; name: string; workspaceId: string; workspaceName: string }[];
  warehouses: { id: string; name: string; workspaceId: string; workspaceName: string; type: string }[];
  users: { id: string; name: string; email: string; role: string; workspaceId: string; workspaceName: string }[];
  totalUnits: number;
}

export async function getAssistantFullSnapshot(): Promise<AssistantFullSnapshot> {
  const [workspacesRes, medsRes, warehousesRes, usersRes, batchesRes] = await Promise.all([
    supabaseAdmin.from("workspaces").select("id, name, slug").order("name"),
    supabaseAdmin.from("medications").select("id, name, workspace_id").order("name"),
    supabaseAdmin.from("warehouses").select("id, name, workspace_id, type").order("name"),
    supabaseAdmin.from("workspace_users").select("id, name, email, role, workspace_id").order("name"),
    supabaseAdmin.from("batches").select("quantity"),
  ]);

  const workspaces = (workspacesRes.data ?? []) as { id: string; name: string; slug: string }[];
  const meds = (medsRes.data ?? []) as { id: string; name: string; workspace_id: string }[];
  const warehouses = (warehousesRes.data ?? []) as { id: string; name: string; workspace_id: string; type: string }[];
  const users = (usersRes.data ?? []) as { id: string; name: string; email: string; role: string; workspace_id: string }[];
  const batches = (batchesRes.data ?? []) as { quantity: number }[];

  const wsMap = new Map(workspaces.map((w) => [w.id, w.name]));

  return {
    workspaces,
    medications: meds.map((m) => ({
      id: m.id,
      name: m.name,
      workspaceId: m.workspace_id,
      workspaceName: wsMap.get(m.workspace_id) ?? m.workspace_id,
    })),
    warehouses: warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      workspaceId: w.workspace_id,
      workspaceName: wsMap.get(w.workspace_id) ?? w.workspace_id,
      type: w.type,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      workspaceId: u.workspace_id,
      workspaceName: wsMap.get(u.workspace_id) ?? u.workspace_id,
    })),
    totalUnits: batches.reduce((s, b) => s + (b.quantity ?? 0), 0),
  };
}

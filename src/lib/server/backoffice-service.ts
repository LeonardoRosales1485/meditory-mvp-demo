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

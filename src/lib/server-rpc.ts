import { createServerFn } from "@tanstack/react-start";
import { fetchWorkspaceData, runAction } from "./server/workspace-service";
import {
  backofficeLogin as boLogin,
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listWarehouses,
  getDashboardData,
  getRealtimeData,
  getConsumptionTrends,
  getSchema,
  getCrossHospitalStock,
  getProcurementOptimization,
  getLossCalculation,
  getWarehouseVolumeData,
  getConsumptionByMedication,
  resetWorkspaceData,
  seedWorkspaceDemo,
  addStockDirectly,
  addStockWithPurchase,
  getAssistantFullSnapshot,
  getAllMedications,
} from "./server/backoffice-service";

export const fetchWorkspaceDataRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    return fetchWorkspaceData(data.workspaceId);
  });

export const runActionRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; payload: unknown }) => data)
  .handler(async ({ data }) => {
    await runAction(data.action as never, data.payload as never);
    return { ok: true };
  });

// ─── Backoffice RPCs ───────────────────────────────────────────────────────

export const backofficeLoginRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    return boLogin(data.email, data.password);
  });

export const backofficeListWorkspacesRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return listWorkspaces();
  });

export const backofficeCreateWorkspaceRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    await createWorkspace(data);
    return { ok: true };
  });

export const backofficeUpdateWorkspaceRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; patch: { name?: string; slug?: string } }) => data)
  .handler(async ({ data }) => {
    await updateWorkspace(data);
    return { ok: true };
  });

export const backofficeDeleteWorkspaceRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await deleteWorkspace(data.id);
    return { ok: true };
  });

export const backofficeListUsersRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return listUsers();
  });

export const backofficeCreateUserRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    workspaceId: string; name: string; email: string; role: string; warehouseIds: string[];
  }) => data)
  .handler(async ({ data }) => {
    await createUser(data);
    return { ok: true };
  });

export const backofficeUpdateUserRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    id: string; patch: { name?: string; email?: string; role?: string; warehouseIds?: string[] };
  }) => data)
  .handler(async ({ data }) => {
    await updateUser(data);
    return { ok: true };
  });

export const backofficeDeleteUserRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await deleteUser(data.id);
    return { ok: true };
  });

export const backofficeListWarehousesRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return listWarehouses();
  });

export const backofficeGetDashboardDataRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return getDashboardData();
  });

export const backofficeGetRealtimeDataRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { workspaceId?: string }) => data)
  .handler(async ({ data }) => {
    return getRealtimeData(data.workspaceId);
  });

export const backofficeGetConsumptionTrendsRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { periodDays: number; workspaceId?: string }) => data)
  .handler(async ({ data }) => {
    return getConsumptionTrends(data.periodDays, data.workspaceId);
  });

export const backofficeGetSchemaRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return getSchema();
  });

export const aiChatRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    model: string;
    messages: { role: string; content: string }[];
    tools?: unknown[];
    provider?: string;
  }) => data)
  .handler(async ({ data }) => {
    const provider = data.provider ?? process.env.LLM_PROVIDER ?? "groq";

    const configs: Record<string, { baseUrl: string; apiKey: string | undefined }> = {
      groq: {
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      },
      zen: {
        baseUrl: "https://opencode.ai/zen/v1",
        apiKey: process.env.ZEN_API_KEY,
      },
    };

    const cfg = configs[provider];
    if (!cfg) throw new Error(`Unknown AI provider: ${provider}`);

    const baseUrl = cfg.baseUrl;
    const apiKey = cfg.apiKey;
    console.debug("[aiChatRpc] provider:", provider, "model:", data.model, "hasApiKey:", !!apiKey, "toolsCount:", data.tools?.length ?? 0);

    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()}_API_KEY no está configurada en el servidor`);
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    headers["Authorization"] = `Bearer ${apiKey}`;

    const bodyPayload = {
      model: data.model,
      messages: data.messages,
      ...(data.tools?.length ? { tools: data.tools } : {}),
      max_tokens: 1024,
      stream: false,
    };
    console.debug("[aiChatRpc] request body keys:", Object.keys(bodyPayload).join(", "));

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[aiChatRpc] HTTP error:", res.status, text.slice(0, 500));
      throw new Error(`LLM API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json() as {
      choices?: { message?: { content?: string; tool_calls?: unknown[] } }[];
      error?: { message?: string };
    };
    console.debug("[aiChatRpc] raw response:", JSON.stringify(json).slice(0, 2000));

    if (json.error) {
      console.error("[aiChatRpc] API error in body:", json.error.message);
    }

    const choice = json.choices?.[0];
    const content = choice?.message?.content ?? "";
    const tool_calls = choice?.message?.tool_calls ?? [];

    if (!content && (!tool_calls || tool_calls.length === 0)) {
      console.warn("[aiChatRpc] empty response — choices:", JSON.stringify(json.choices));
    }

    return { content, tool_calls };
  });

// ─────────────────────────────────────────────────────────────
//  RPCs DEMO FINAL — Cross-Hospital & Compras
// ─────────────────────────────────────────────────────────────

export const backofficeGetCrossHospitalStockRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getCrossHospitalStock();
});

export const backofficeGetProcurementOptimizationRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { medicationName?: string }) => data)
  .handler(async ({ data }) => {
    return getProcurementOptimization(data.medicationName);
  });

export const backofficeGetLossCalculationRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getLossCalculation();
});

export const backofficeGetWarehouseVolumeDataRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getWarehouseVolumeData();
});

export const backofficeGetConsumptionByMedicationRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { periodDays?: number }) => data)
  .handler(async ({ data }) => {
    return getConsumptionByMedication(data.periodDays ?? 30);
  });

export const backofficeResetWorkspaceRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    await resetWorkspaceData(data.workspaceId);
    return { ok: true };
  });

export const backofficeSeedWorkspaceRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { workspaceId: string; workspaceName: string }) => data)
  .handler(async ({ data }) => {
    await seedWorkspaceDemo(data.workspaceId, data.workspaceName);
    return { ok: true };
  });

export const backofficeGetAllMedicationsRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getAllMedications();
});

// ─── RPCs Asistente con Acciones ──────────────────────────────────────────

export const backofficeAddStockDirectlyRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    medicationId: string;
    warehouseId: string;
    quantity: number;
    lot?: string;
    expiry?: string;
  }) => data)
  .handler(async ({ data }) => {
    return addStockDirectly(data);
  });

export const backofficeAddStockWithPurchaseRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    medicationId: string;
    warehouseId: string;
    quantity: number;
    lot?: string;
    expiry?: string;
    invoiceRef?: string;
    unitPrice?: number;
  }) => data)
  .handler(async ({ data }) => {
    return addStockWithPurchase(data);
  });

export const backofficeGetAssistantFullSnapshotRpc = createServerFn({ method: "GET" })
  .handler(async () => {
    return getAssistantFullSnapshot();
  });

export const backofficeUpdateStockConfigRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    medicationId: string;
    warehouseId: string;
    minStock: number;
    optimalStock: number;
  }) => data)
  .handler(async ({ data }) => {
    const { updateStockConfig } = await import("@/lib/server/backoffice-service");
    await updateStockConfig(data.medicationId, data.warehouseId, data.minStock, data.optimalStock);
    return { ok: true };
  });

export const updateStockConfigRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    actor: string;
    workspaceId: string;
    medicationId: string;
    warehouseId: string;
    minStock: number;
    optimalStock: number;
  }) => data)
  .handler(async ({ data }) => {
    const { updateStockConfig } = await import("@/lib/server/workspace-service");
    await updateStockConfig(data.actor, data.workspaceId, data.medicationId,
      data.warehouseId, data.minStock, data.optimalStock);
    return { ok: true };
  });

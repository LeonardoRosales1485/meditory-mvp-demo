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
  }) => data)
  .handler(async ({ data }) => {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: data.model,
        messages: data.messages,
        tools: data.tools?.length ? data.tools : undefined,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => "");
      throw new Error(`Groq API error ${groqRes.status}: ${text.slice(0, 500)}`);
    }

    const json = await groqRes.json() as {
      choices?: { message?: { content?: string; tool_calls?: unknown[] } }[];
    };

    return {
      content: json.choices?.[0]?.message?.content ?? "",
      tool_calls: json.choices?.[0]?.message?.tool_calls ?? [],
    };
  });

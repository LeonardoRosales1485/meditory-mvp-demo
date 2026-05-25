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
  seedTransfers,
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
  getLowStockMedications,
  getOverstockMedications,
  getLossByOverstock,
  calcularCantidadSugerida,
  getProveedores,
  getWorkspaces,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  createBackofficeTransfer,
  getLicitaciones,
  getLicitacion,
  getLicitacionItems,
  getLicitacionOfertas,
  getLicitacionHistorial,
  createLicitacion,
  updateLicitacion,
  deleteLicitacion,
  cambiarEstadoLicitacion,
  createOferta,
  updateOferta,
  deleteOferta,
  adjudicarOferta,
  findSimilarLicitaciones,
  getPublicLicitaciones,
  getPublicLicitacionDetail,
  getPublicMiOferta,
  identifyProveedor,
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

export const backofficeSeedTransfersRpc = createServerFn({ method: "POST" })
  .handler(async () => {
    return seedTransfers();
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
    try {
      const provider = data.provider ?? "anthropic";
      console.debug("[aiChatRpc] provider:", provider, "model:", data.model, "toolsCount:", data.tools?.length ?? 0);

      // ── Anthropic (Claude) ──────────────────────────────────────────────────
      if (provider === "anthropic") {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada en el servidor");

        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });

        const systemContent = data.messages.find((m) => m.role === "system")?.content ?? "";
        const conversationMsgs = data.messages.filter((m) => m.role !== "system");

        type AnthropicTool = { name: string; description: string; input_schema: Record<string, unknown> };
        const anthropicTools: AnthropicTool[] = ((data.tools ?? []) as { function: { name: string; description: string; parameters: Record<string, unknown> } }[])
          .map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          }));

        const response = await client.messages.create({
          model: data.model,
          max_tokens: 2048,
          // Prompt caching: el system prompt (instrucciones + snapshot) se cachea 5 min,
          // reduciendo latencia y costo ~90% en requests sucesivos.
          ...(systemContent ? {
            system: [{ type: "text" as const, text: systemContent, cache_control: { type: "ephemeral" as const } }],
          } : {}),
          messages: conversationMsgs.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          ...(anthropicTools.length > 0 ? { tools: anthropicTools as Parameters<typeof client.messages.create>[0]["tools"] } : {}),
        });

        let content = "";
        const tool_calls: { id: string; type: string; function: { name: string; arguments: string } }[] = [];

        for (const block of response.content) {
          if (block.type === "text") content += block.text;
          else if (block.type === "tool_use") {
            tool_calls.push({
              id: block.id,
              type: "function",
              function: { name: block.name, arguments: JSON.stringify(block.input) },
            });
          }
        }

        console.debug("[aiChatRpc] anthropic usage:", JSON.stringify(response.usage));
        return { content, tool_calls };
      }

      // ── OpenAI-compatible (Zen / Groq / Ollama) ─────────────────────────────
      const configs: Record<string, { baseUrl: string; apiKey: string | undefined }> = {
        zen: { baseUrl: "https://opencode.ai/zen/v1", apiKey: process.env.ZEN_API_KEY },
        groq: { baseUrl: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY },
        ollama: { baseUrl: "http://localhost:11434/v1", apiKey: undefined },
      };

      const cfg = configs[provider];
      if (!cfg) throw new Error(`Unknown AI provider: ${provider}`);

      const { baseUrl, apiKey } = cfg;
      if (!apiKey && provider !== "ollama") {
        throw new Error(`${provider.toUpperCase()}_API_KEY no está configurada en el servidor`);
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const bodyPayload = {
        model: data.model,
        messages: data.messages,
        ...(data.tools?.length ? { tools: data.tools } : {}),
        max_tokens: 1024,
        stream: false,
      };

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

      const choice = json.choices?.[0];
      const content = choice?.message?.content ?? "";
      const rawToolCalls = choice?.message?.tool_calls ?? [];

      const tool_calls = rawToolCalls.map((tc: any) => {
        const rawArgs = tc?.function?.arguments;
        return {
          id: String(tc?.id ?? ""),
          type: String(tc?.type ?? ""),
          function: {
            name: String(tc?.function?.name ?? ""),
            arguments: typeof rawArgs === "object" ? JSON.stringify(rawArgs) : String(rawArgs ?? ""),
          },
        };
      });

      if (!content && tool_calls.length === 0) {
        console.warn("[aiChatRpc] empty response — choices:", JSON.stringify(json.choices));
      }

      return { content, tool_calls };
    } catch (e) {
      console.error("[aiChatRpc] handler error:", e);
      throw e;
    }
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

export const backofficeCreateTransferRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    medicationId: string;
    sourceBatchId?: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
  }) => data)
  .handler(async ({ data }) => {
    return createBackofficeTransfer(data);
  });

export const backofficeAdvanceTransferRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supabaseAdmin = (await import("@/lib/server/supabase-admin")).supabaseAdmin;
    const { data: transfer } = await supabaseAdmin.from("transfer_requests").select("workspace_id").eq("id", data.id).single();
    if (!transfer) throw new Error("Transferencia no encontrada");
    return runAction("advanceTransfer", {
      workspaceId: transfer.workspace_id,
      actor: "Asistente Medi",
      id: data.id,
    });
  });

export const backofficeRejectTransferRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; reason: string; outcome: "devolver" | "descartar" }) => data)
  .handler(async ({ data }) => {
    const supabaseAdmin = (await import("@/lib/server/supabase-admin")).supabaseAdmin;
    const { data: transfer } = await supabaseAdmin.from("transfer_requests").select("workspace_id").eq("id", data.id).single();
    if (!transfer) throw new Error("Transferencia no encontrada");
    return runAction("rejectTransfer", {
      workspaceId: transfer.workspace_id,
      actor: "Asistente Medi",
      id: data.id,
      reason: data.reason,
      outcome: data.outcome,
    });
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

// ─── RPCs Licitaciones ────────────────────────────────────────────────────

export const licitacionesGetWorkspacesRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getWorkspaces();
});

export const licitacionesGetLowStockRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getLowStockMedications();
});

export const licitacionesGetOverstockRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getOverstockMedications();
});

export const licitacionesGetLossByOverstockRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getLossByOverstock();
});

export const licitacionesCalcularCantidadRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    medicationId: string;
    workspaceId: string;
    deficitTotal: number;
    estimatedLeadDays?: number;
  }) => data)
  .handler(async ({ data }) => {
    return calcularCantidadSugerida(data);
  });

export const licitacionesGetProveedoresRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { soloActivos?: boolean }) => data)
  .handler(async ({ data }) => {
    return getProveedores(data);
  });

export const licitacionesCreateProveedorRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    nombre: string;
    contacto?: string;
    telefono?: string;
    email?: string;
    cuit?: string;
    direccion?: string;
  }) => data)
  .handler(async ({ data }) => {
    return createProveedor(data);
  });

export const licitacionesUpdateProveedorRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    id: string;
    patch: Partial<{
      nombre: string;
      contacto: string;
      telefono: string;
      email: string;
      cuit: string;
      direccion: string;
      activo: boolean;
    }>;
  }) => data)
  .handler(async ({ data }) => {
    return updateProveedor(data.id, data.patch);
  });

export const licitacionesDeleteProveedorRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await deleteProveedor(data.id);
    return { ok: true };
  });

export const licitacionesGetAllRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getLicitaciones();
});

export const licitacionesGetOneRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return getLicitacion(data.id);
  });

export const licitacionesGetItemsRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { licitacionId: string }) => data)
  .handler(async ({ data }) => {
    return getLicitacionItems(data.licitacionId);
  });

export const licitacionesGetOfertasRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { licitacionId: string }) => data)
  .handler(async ({ data }) => {
    return getLicitacionOfertas(data.licitacionId);
  });

export const licitacionesGetHistorialRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { licitacionId: string }) => data)
  .handler(async ({ data }) => {
    return getLicitacionHistorial(data.licitacionId);
  });

export const licitacionesCreateRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    codigo?: string;
    titulo: string;
    descripcion?: string;
    fecha_limite_ofertas?: string;
    fecha_estimada_entrega?: string;
    creado_por?: string;
    observaciones?: string;
    items: Array<{
      medication_id: string;
      workspace_id: string;
      cantidad_solicitada: number;
      precio_unitario_estimado?: number;
      justificacion?: string;
    }>;
  }) => data)
  .handler(async ({ data }) => {
    return createLicitacion(data);
  });

export const licitacionesUpdateRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    id: string;
    patch: Partial<{
      titulo: string;
      descripcion: string;
      fecha_limite_ofertas: string | null;
      fecha_estimada_entrega: string | null;
      observaciones: string;
    }>;
  }) => data)
  .handler(async ({ data }) => {
    return updateLicitacion(data.id, data.patch);
  });

export const licitacionesDeleteRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await deleteLicitacion(data.id);
    return { ok: true };
  });

export const licitacionesCambiarEstadoRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    licitacionId: string;
    nuevoEstado: "borrador" | "en_licitacion" | "ofertas_recibidas" | "adjudicado" | "en_ejecucion" | "completado" | "cancelado";
    usuario?: string;
    comentario?: string;
  }) => data)
  .handler(async ({ data }) => {
    return cambiarEstadoLicitacion(data);
  });

export const licitacionesCreateOfertaRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    licitacion_id: string;
    proveedor_id: string;
    monto_total: number;
    plazo_entrega_dias?: number;
    observaciones?: string;
  }) => data)
  .handler(async ({ data }) => {
    return createOferta(data);
  });

export const licitacionesUpdateOfertaRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    id: string;
    patch: Partial<{
      monto_total: number;
      plazo_entrega_dias: number;
      observaciones: string;
      adjudicado: boolean;
    }>;
  }) => data)
  .handler(async ({ data }) => {
    return updateOferta(data.id, data.patch);
  });

export const licitacionesDeleteOfertaRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await deleteOferta(data.id);
    return { ok: true };
  });

export const licitacionesAdjudicarOfertaRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    licitacionId: string;
    ofertaId: string;
    usuario?: string;
  }) => data)
  .handler(async ({ data }) => {
    await adjudicarOferta(data);
    return { ok: true };
  });

export const licitacionesFindSimilarRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { medicationIds: string[] }) => data)
  .handler(async ({ data }) => {
    return findSimilarLicitaciones(data.medicationIds);
  });

// ─── RPCs Portal Público de Proveedores ─────────────────────

export const proveedoresGetLicitacionesRpc = createServerFn({ method: "GET" }).handler(async () => {
  return getPublicLicitaciones();
});

export const proveedoresGetLicitacionDetailRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return getPublicLicitacionDetail(data.id);
  });

export const proveedoresGetMiOfertaRpc = createServerFn({ method: "GET" })
  .inputValidator((data: { licitacionId: string; proveedorId: string }) => data)
  .handler(async ({ data }) => {
    return getPublicMiOferta(data.licitacionId, data.proveedorId);
  });

export const proveedoresIdentifyRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { cuit: string }) => data)
  .handler(async ({ data }) => {
    return identifyProveedor(data.cuit);
  });

export const proveedoresCrearOfertaRpc = createServerFn({ method: "POST" })
  .inputValidator((data: {
    licitacion_id: string;
    proveedor_id: string;
    monto_total: number;
    plazo_entrega_dias: number;
    observaciones?: string;
  }) => data)
  .handler(async ({ data }) => {
    return createOferta(data);
  });

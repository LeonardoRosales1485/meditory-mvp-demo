export type ChartSpec = {
  chartType: "bar" | "pie" | "area" | "line";
  title: string;
  data: { name: string; value: number; fill?: string }[];
};

/** Definición de tools para el asistente (OpenAI-compatible function schema). */
export const assistantTools = [
  {
    type: "function" as const,
    function: {
      name: "navigate",
      description:
        "Abre una pantalla interna SOLO si el usuario pidió ir/abrir/mostrar. Rutas válidas empiezan con /app/ (ej. /app/transferencias). NUNCA para preguntas solo informativas (cantidades, listados, transferencias en tránsito): respondé en texto con institucion_snapshot. search: solo strings planos (IDs del snapshot), nunca objetos anidados.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Ruta absoluta interna, ej. /app/inventario",
          },
          search: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Query opcional, ej. { medicamento: \"uuid\" }",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_transfer",
      description:
        "Solicita transferencia de stock solo si el usuario pidió EXPLÍCITAMENTE crear/solicitar/iniciar una transferencia con datos del snapshot (medicationId, sourceBatchId, depósitos, cantidad). PROHIBIDO para consultas del tipo «¿cuánto hay en transferencia?» o «¿qué está por recibir?» (respondé con pendingTransfers y summary). Requiere confirmación en pantalla.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string" },
          sourceBatchId: { type: "string" },
          fromWarehouseId: { type: "string" },
          toWarehouseId: { type: "string" },
          quantity: { type: "number" },
        },
        required: ["medicationId", "sourceBatchId", "fromWarehouseId", "toWarehouseId", "quantity"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "render_chart",
      description:
        "Genera un gráfico visual (barra, torta, área o línea) con datos del snapshot. Usar cuando el usuario pida explícitamente «mostrar gráfico», «graficar», «chart», «pastel», «barras», «distribución visual», «comparar visualmente». Los datos deben extraerse del institucion_snapshot. Para stock por depósito usar stockByWarehouse; para vencimientos usar expiryDistribution; para top medicamentos usar topMedicationsByUnits.",
      parameters: {
        type: "object",
        properties: {
          chartType: {
            type: "string",
            enum: ["bar", "pie", "area", "line"],
            description: "Tipo de gráfico: bar (barras verticales), pie (torta), area (área), line (línea)",
          },
          title: {
            type: "string",
            description: "Título descriptivo del gráfico, ej. «Stock por depósito»",
          },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nombre de la categoría" },
                value: { type: "number", description: "Valor numérico" },
              },
              required: ["name", "value"],
            },
            description: "Array de puntos {name, value} para el gráfico. Máximo 20 ítems.",
          },
        },
        required: ["chartType", "title", "data"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_stock",
      description:
        "Agrega unidades a un medicamento en un depósito específico. Usar SOLO cuando el usuario pida explícitamente agregar, cargar o aumentar stock. Requiere medicationId y warehouseId del snapshot. El campo registerAsPurchase=true registra además un movimiento de compra.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento (del snapshot)" },
          warehouseId: { type: "string", description: "ID del depósito destino (del snapshot)" },
          quantity: { type: "number", description: "Cantidad de unidades a agregar (entero positivo)" },
          lot: { type: "string", description: "Número de lote (opcional)" },
          expiry: { type: "string", description: "Fecha de vencimiento ISO 8601 (opcional)" },
          invoiceRef: { type: "string", description: "Referencia de factura (solo si registerAsPurchase=true)" },
          registerAsPurchase: { type: "boolean", description: "Si true, registra como compra además del ingreso" },
        },
        required: ["medicationId", "warehouseId", "quantity"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_users",
      description:
        "Lista los usuarios de una institución. Usar cuando el usuario pregunte por usuarios, empleados o personal de un hospital. Si no especifica hospital, listar todos.",
      parameters: {
        type: "object",
        properties: {
          workspaceId: { type: "string", description: "ID del workspace (opcional, del snapshot)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_user",
      description:
        "Crea un nuevo usuario en una institución. Usar solo cuando el usuario pida explícitamente crear/agregar un usuario con nombre, email, rol e institución.",
      parameters: {
        type: "object",
        properties: {
          workspaceId: { type: "string", description: "ID del workspace destino (del snapshot)" },
          name: { type: "string", description: "Nombre completo del usuario" },
          email: { type: "string", description: "Email del usuario" },
          role: { type: "string", enum: ["admin", "tecnico", "operador"], description: "Rol del usuario" },
        },
        required: ["workspaceId", "name", "email", "role"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_user",
      description:
        "Elimina un usuario del sistema. Usar SOLO cuando el usuario pida explícitamente eliminar/borrar un usuario, con su ID o nombre inequívoco. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "ID del usuario a eliminar (del snapshot)" },
        },
        required: ["userId"],
      },
    },
  },
];

/** Rutas internas permitidas para la tool `navigate` (evita open redirect). */
export const ASSISTANT_ALLOWED_NAV_PATHS = [
  "/app",
  "/app/inventario",
  "/app/catalogo",
  "/app/ingresos",
  "/app/ajustes",
  "/app/transferencias",
  "/app/depositos",
  "/app/vencimientos",
  "/app/auditoria",
  "/app/usuarios",
  "/app/pedidos",
  "/app/salas",
  "/app/pacientes",
  "/app/ventas",
  "/app/lista-precios",
  "/app/dispensacion",
  "/app/demo-tools",
] as const;

export type AssistantAllowedPath = (typeof ASSISTANT_ALLOWED_NAV_PATHS)[number];

const allowedSet = new Set<string>(ASSISTANT_ALLOWED_NAV_PATHS);

export type NavigateToolArgs = {
  path: string;
  /** Query params string-only para inventario etc. */
  search?: Record<string, string>;
};

export type CreateTransferToolArgs = {
  medicationId: string;
  sourceBatchId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
};

export type RenderChartArgs = {
  chartType: "bar" | "pie" | "area" | "line";
  title: string;
  data: { name: string; value: number }[];
};

/** Opciones compatibles con `navigate()` de TanStack Router. */
export type AssistantNavigateOptions = {
  to: string;
  search?: Record<string, string | undefined>;
};

export function isAllowedAssistantPath(path: string): path is AssistantAllowedPath {
  return allowedSet.has(path);
}

export function parseNavigateArgs(raw: unknown): NavigateToolArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const path = typeof o.path === "string" ? o.path.trim() : "";
  if (!path || !isAllowedAssistantPath(path)) return null;
  let search: Record<string, string> | undefined;
  if (o.search !== undefined) {
    if (typeof o.search !== "object" || o.search === null) return null;
    const s = o.search as Record<string, unknown>;
    search = {};
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "string" && v.trim()) search[k] = v.trim();
      else if (typeof v === "number") search[k] = String(v);
      else return null;
    }
  }
  return { path, search };
}

export function parseCreateTransferArgs(raw: unknown): CreateTransferToolArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const sourceBatchId = typeof o.sourceBatchId === "string" ? o.sourceBatchId.trim() : "";
  const fromWarehouseId = typeof o.fromWarehouseId === "string" ? o.fromWarehouseId.trim() : "";
  const toWarehouseId = typeof o.toWarehouseId === "string" ? o.toWarehouseId.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  if (!medicationId || !sourceBatchId || !fromWarehouseId || !toWarehouseId) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return null;
  return { medicationId, sourceBatchId, fromWarehouseId, toWarehouseId, quantity: Math.floor(quantity) };
}

export function navigateToolToOptions(args: NavigateToolArgs): AssistantNavigateOptions {
  const to = args.path;
  if (!args.search || Object.keys(args.search).length === 0) {
    return { to };
  }
  return { to, search: args.search };
}

export function parseRenderChartArgs(raw: unknown): RenderChartArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const chartType = o.chartType as string;
  if (!["bar", "pie", "area", "line"].includes(chartType)) return null;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title || title.length > 200) return null;
  if (!Array.isArray(o.data) || o.data.length === 0 || o.data.length > 20) return null;
  const data: { name: string; value: number }[] = [];
  for (const item of o.data) {
    if (!item || typeof item !== "object") return null;
    const d = item as Record<string, unknown>;
    const name = typeof d.name === "string" ? d.name.trim() : "";
    const value = typeof d.value === "number" ? d.value : Number(d.value);
    if (!name || !Number.isFinite(value) || value < 0) return null;
    data.push({ name, value });
  }
  return { chartType: chartType as RenderChartArgs["chartType"], title, data };
}

export type OllamaToolCall = {
  function?: { name: string; arguments: string | Record<string, unknown> };
};

export type AddStockArgs = {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  lot?: string;
  expiry?: string;
  invoiceRef?: string;
  registerAsPurchase?: boolean;
};

export type ListUsersArgs = {
  workspaceId?: string;
};

export type CreateUserArgs = {
  workspaceId: string;
  name: string;
  email: string;
  role: "admin" | "tecnico" | "operador";
};

export type DeleteUserArgs = {
  userId: string;
};

export function parseAddStockArgs(raw: unknown): AddStockArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const warehouseId = typeof o.warehouseId === "string" ? o.warehouseId.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  if (!medicationId || !warehouseId) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return null;
  return {
    medicationId,
    warehouseId,
    quantity: Math.floor(quantity),
    lot: typeof o.lot === "string" ? o.lot.trim() : undefined,
    expiry: typeof o.expiry === "string" ? o.expiry.trim() : undefined,
    invoiceRef: typeof o.invoiceRef === "string" ? o.invoiceRef.trim() : undefined,
    registerAsPurchase: typeof o.registerAsPurchase === "boolean" ? o.registerAsPurchase : false,
  };
}

export function parseListUsersArgs(raw: unknown): ListUsersArgs {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    workspaceId: typeof o.workspaceId === "string" ? o.workspaceId.trim() : undefined,
  };
}

export function parseCreateUserArgs(raw: unknown): CreateUserArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const workspaceId = typeof o.workspaceId === "string" ? o.workspaceId.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const role = typeof o.role === "string" ? o.role.trim() : "";
  if (!workspaceId || !name || !email || !["admin", "tecnico", "operador"].includes(role)) return null;
  if (!email.includes("@")) return null;
  return { workspaceId, name, email, role: role as CreateUserArgs["role"] };
}

export function parseDeleteUserArgs(raw: unknown): DeleteUserArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId.trim() : "";
  if (!userId) return null;
  return { userId };
}

/** Parte respuestas tipo `{...};{...}` donde cada trozo es JSON de navigate/create_transfer. */
function splitConcatenatedJsonObjects(t: string): string[] {
  const s = t.trim();
  const rawParts = s.split(/\}\s*;\s*\{/);
  if (rawParts.length === 1) return [s];
  const out: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    let p = rawParts[i]!.trim();
    if (i > 0) p = `{${p}`;
    if (i < rawParts.length - 1) p = `${p}}`;
    out.push(p);
  }
  return out;
}

/**
 * Si el modelo volcó solo JSON de herramientas (a veces concatenado con `;`), lo quitamos para poder rellenar con datos reales.
 */
export function stripBareToolJsonFromAssistantContent(content: string): string {
  const t = content.trim();
  if (!t || t.length > 8000) return content;
  if (!/"name"\s*:\s*"(navigate|create_transfer|render_chart|add_stock|list_users|create_user|delete_user)"/i.test(t)) return content;
  const chunks = splitConcatenatedJsonObjects(t);
  let toolish = 0;
  for (const ch of chunks) {
    try {
      const o = JSON.parse(ch) as { name?: string };
      if (o && typeof o === "object" && ["navigate", "create_transfer", "render_chart", "add_stock", "list_users", "create_user", "delete_user"].includes(o.name ?? "")) toolish++;
      else return content;
    } catch {
      if (chunks.length > 1 && t.length < 4000 && /"name"\s*:\s*"(navigate|create_transfer|add_stock|list_users|create_user|delete_user)"/i.test(t)) {
        return "";
      }
      return content;
    }
  }
  if (toolish === chunks.length && toolish > 0) return "";
  return content;
}

export function parseOllamaToolArguments(tc: OllamaToolCall): unknown {
  const fn = tc.function;
  if (!fn) return null;
  const a = fn.arguments;
  if (typeof a === "object" && a !== null) return a;
  if (typeof a === "string") {
    try {
      return JSON.parse(a || "{}");
    } catch {
      return null;
    }
  }
  return null;
}

/** Extrae bloques [[TOOL:...]] del texto (modelos sin API de tools). */
export function extractLegacyToolBlocks(content: string): { cleanContent: string; tools: { name: string; args: unknown }[] } {
  const tools: { name: string; args: unknown }[] = [];
  const re = /\[\[TOOL:([\s\S]*?)\]\]/g;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  const parts: string[] = [];
  while ((m = re.exec(content)) !== null) {
    parts.push(content.slice(lastIndex, m.index));
    lastIndex = m.index + m[0].length;
    try {
      const parsed = JSON.parse(m[1]!.trim()) as { name?: string; args?: unknown };
      if (typeof parsed.name === "string") tools.push({ name: parsed.name, args: parsed.args });
    } catch {
      /* ignore */
    }
  }
  parts.push(content.slice(lastIndex));
  const cleanContent = parts.join("").trim();
  return { cleanContent, tools };
}

export function validateTransferAgainstBatches(
  args: CreateTransferToolArgs,
  batches: { id: string; medicationId: string; warehouseId: string; quantity: number }[],
): string | null {
  const b = batches.find((x) => x.id === args.sourceBatchId);
  if (!b) return "Lote origen no encontrado.";
  if (b.warehouseId !== args.fromWarehouseId) return "El lote no está en el depósito origen indicado.";
  if (b.medicationId !== args.medicationId) return "El lote no corresponde al medicamento indicado.";
  if (args.quantity > b.quantity) return `Cantidad mayor al stock del lote (${b.quantity} u).`;
  if (args.fromWarehouseId === args.toWarehouseId) return "Origen y destino no pueden ser el mismo depósito.";
  return null;
}

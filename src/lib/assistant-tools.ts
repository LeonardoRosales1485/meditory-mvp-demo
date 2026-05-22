/** Definición de tools para Groq (OpenAI-compatible function schema). */
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

export type OllamaToolCall = {
  function?: { name: string; arguments: string | Record<string, unknown> };
};

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
  if (!/"name"\s*:\s*"(navigate|create_transfer)"/i.test(t)) return content;
  const chunks = splitConcatenatedJsonObjects(t);
  let toolish = 0;
  for (const ch of chunks) {
    try {
      const o = JSON.parse(ch) as { name?: string };
      if (o && typeof o === "object" && (o.name === "navigate" || o.name === "create_transfer")) toolish++;
      else return content;
    } catch {
      if (chunks.length > 1 && t.length < 4000 && /"name"\s*:\s*"(navigate|create_transfer)"/i.test(t)) {
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

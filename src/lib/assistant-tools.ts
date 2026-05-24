export type ChartSpec = {
  chartType: "bar" | "pie" | "area" | "line";
  title: string;
  data: { name: string; value: number; fill?: string }[];
};

/** Definición de tools para el asistente (OpenAI-compatible function schema). */
export const assistantTools = [
  {
    type: "function" as const,
    "function": {
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
    "function": {
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
    "function": {
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
    "function": {
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
    "function": {
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
    "function": {
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
    "function": {
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
  {
    type: "function" as const,
    "function": {
      name: "create_sale",
      description:
        "Registra una venta al público de un medicamento. Usar SOLO cuando el usuario pida explícitamente vender, cobrar o facturar un medicamento. Requiere medicationId, warehouseId, quantity, price (precio unitario) del snapshot. Prescription y doctor son opcionales para venta con receta. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento a vender (del snapshot)" },
          warehouseId: { type: "string", description: "ID del depósito de ventas (del snapshot)" },
          quantity: { type: "number", description: "Cantidad a vender (entero positivo)" },
          price: { type: "number", description: "Precio unitario de venta" },
          prescription: { type: "string", description: "Número de receta (opcional)" },
          doctor: { type: "string", description: "Nombre del médico (opcional, si hay receta)" },
        },
        required: ["medicationId", "warehouseId", "quantity", "price"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "create_dispensation",
      description:
        "Registra una dispensación de medicamento a un paciente internado. Usar SOLO cuando el usuario pida explícitamente dispensar, entregar o administrar medicación a un paciente. Requiere medicationId, warehouseId, quantity, doctor, patient, room, treatment del snapshot. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento a dispensar (del snapshot)" },
          warehouseId: { type: "string", description: "ID del depósito desde donde se dispensa (del snapshot)" },
          quantity: { type: "number", description: "Cantidad a dispensar (entero positivo)" },
          doctor: { type: "string", description: "Nombre del médico que prescribe" },
          patient: { type: "string", description: "Nombre o ID del paciente (del snapshot)" },
          room: { type: "string", description: "Sala/habitación del paciente (del snapshot)" },
          treatment: { type: "string", description: "Indicación o tratamiento" },
        },
        required: ["medicationId", "warehouseId", "quantity", "doctor", "patient", "room", "treatment"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "create_order",
      description:
        "Crea un pedido de medicación desde una sala/paciente. Usar SOLO cuando el usuario pida explícitamente pedir, solicitar o crear un pedido de medicación. Requiere medicationId, warehouseId, quantity, patient, room, reason del snapshot. doctorName es opcional. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento solicitado (del snapshot)" },
          warehouseId: { type: "string", description: "ID del depósito destino (del snapshot)" },
          quantity: { type: "number", description: "Cantidad solicitada (entero positivo)" },
          patient: { type: "string", description: "Nombre o ID del paciente" },
          room: { type: "string", description: "Sala/habitación (del snapshot)" },
          reason: { type: "string", description: "Motivo del pedido" },
          doctorName: { type: "string", description: "Nombre del médico solicitante (opcional)" },
        },
        required: ["medicationId", "warehouseId", "quantity", "patient", "room", "reason"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "process_order",
      description:
        "Avanza un pedido de medicación al siguiente estado. Usar SOLO cuando el usuario pida explícitamente aprobar, despachar, confirmar recepción, administrar o procesar un pedido. Action puede ser: aprobar, despachar, confirmar_recepcion, administrar. Requiere orderId del snapshot. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "ID del pedido a procesar (del snapshot)" },
          action: {
            type: "string",
            enum: ["aprobar", "despachar", "confirmar_recepcion", "administrar", "rechazar"],
            description: "Acción a ejecutar sobre el pedido"
          },
          reason: { type: "string", description: "Motivo (obligatorio si se rechaza)" },
        },
        required: ["orderId", "action"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "advance_transfer",
      description:
        "Avanza una transferencia al siguiente estado del flujo. Usar SOLO cuando el usuario pida explícitamente autorizar, despachar, recibir o aceptar una transferencia existente. Requiere transferId del snapshot. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          transferId: { type: "string", description: "ID de la transferencia a avanzar (del snapshot)" },
        },
        required: ["transferId"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "reject_transfer",
      description:
        "Rechaza una transferencia con opción de devolver el stock al origen o descartarlo. Usar SOLO cuando el usuario pida explícitamente rechazar, cancelar o devolver una transferencia. Requiere transferId, reason y outcome (devolver o descartar). Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          transferId: { type: "string", description: "ID de la transferencia a rechazar (del snapshot)" },
          reason: { type: "string", description: "Motivo del rechazo" },
          outcome: { type: "string", enum: ["devolver", "descartar"], description: "Qué hacer con el stock: devolver al origen o descartar" },
        },
        required: ["transferId", "reason", "outcome"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "manage_medication",
      description:
        "Crea o actualiza un medicamento en el catálogo. Usar SOLO cuando el usuario pida explícitamente agregar, crear, editar o modificar un medicamento. Para crear: incluir name, activeIngredient, concentrationValue, concentrationUnit, form. Para actualizar: incluir medicationId y los campos a modificar. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento a actualizar (omitir si es nuevo)" },
          name: { type: "string", description: "Nombre del medicamento" },
          activeIngredient: { type: "string", description: "Principio activo" },
          concentrationValue: { type: "number", description: "Valor de concentración" },
          concentrationUnit: { type: "string", enum: ["mg", "mcg", "ml", "L", "g", "unidad"], description: "Unidad de concentración" },
          form: { type: "string", description: "Forma farmacéutica (comprimido, jarabe, inyectable, etc.)" },
          salePrice: { type: "number", description: "Precio de venta unitario (opcional)" },
          saleEnabled: { type: "boolean", description: "Si está habilitado para venta (opcional)" },
        },
        required: ["name", "activeIngredient", "concentrationValue", "concentrationUnit", "form"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "manage_warehouse",
      description:
        "Crea o actualiza un depósito/almacén. Usar SOLO cuando el usuario pida explícitamente agregar, crear, editar o modificar un depósito. Para crear: incluir name, type. Para actualizar: incluir warehouseId y los campos a modificar. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          warehouseId: { type: "string", description: "ID del depósito a actualizar (omitir si es nuevo)" },
          name: { type: "string", description: "Nombre del depósito" },
          type: { type: "string", enum: ["central", "interna", "ventas"], description: "Tipo de depósito" },
        },
        required: ["name", "type"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "manage_patient",
      description:
        "Crea o actualiza un paciente internado. Usar SOLO cuando el usuario pida explícitamente internar, registrar, ingresar o modificar un paciente. Para crear: incluir firstName, lastName, insurance, diagnosis, assignedDoctor, room. Para actualizar: incluir patientId y los campos a modificar. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          patientId: { type: "string", description: "ID del paciente a actualizar (omitir si es nuevo)" },
          firstName: { type: "string", description: "Nombre del paciente" },
          lastName: { type: "string", description: "Apellido del paciente" },
          insurance: { type: "string", description: "Obra social / seguro" },
          diagnosis: { type: "string", description: "Diagnóstico" },
          assignedDoctor: { type: "string", description: "Médico a cargo" },
          room: { type: "string", description: "Sala/habitación" },
        },
        required: ["firstName", "lastName", "insurance", "diagnosis", "assignedDoctor", "room"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "update_stock_config",
      description:
        "Configura los niveles de stock mínimo y óptimo para un medicamento en un depósito específico. Usar SOLO cuando el usuario pida explícitamente configurar, ajustar o cambiar niveles de stock mínimo/óptimo. Requiere medicationId, warehouseId, minStock y optimalStock del snapshot. Requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          medicationId: { type: "string", description: "ID del medicamento (del snapshot)" },
          warehouseId: { type: "string", description: "ID del depósito (del snapshot)" },
          minStock: { type: "number", description: "Stock mínimo (entero no negativo)" },
          optimalStock: { type: "number", description: "Stock óptimo (entero, debe ser >= minStock)" },
        },
        required: ["medicationId", "warehouseId", "minStock", "optimalStock"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "generate_report",
      description:
        "Genera un reporte PDF descargable. Usar SOLO cuando el usuario pida explícitamente generar, descargar, exportar o imprimir un reporte/informe. Tipos: stock (stock actual por depósito), expiries (lotes próximos a vencer), movements (movimientos por período).",
      parameters: {
        type: "object",
        properties: {
          reportType: {
            type: "string",
            enum: ["stock", "expiries", "movements"],
            description: "Tipo de reporte: stock (stock actual), expiries (vencimientos), movements (movimientos)"
          },
          title: { type: "string", description: "Título del reporte (opcional)" },
          periodDays: { type: "number", description: "Días hacia atrás para incluir (solo movements, opcional, default 30)" },
        },
        required: ["reportType"],
      },
    },
  },
  /** Rutas internas permitidas para la tool `navigate` (evita open redirect). */
  {
    type: "function" as const,
    "function": {
      name: "create_licitacion",
      description:
        "Crea una nueva licitación con sus items. Usar cuando el usuario pida crear una licitación y hayas acordado los detalles (título, descripción, medicamentos, cantidades).",
      parameters: {
        type: "object",
        properties: {
            codigo: { type: "string", description: "Código único de la licitación (opcional - si no se provee se genera automáticamente), ej: LIC-0005" },
          titulo: { type: "string", description: "Título descriptivo de la licitación" },
          descripcion: { type: "string", description: "Descripción detallada" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                medication_id: { type: "string", description: "ID del medicamento" },
                workspace_id: { type: "string", description: "ID del workspace/hospital" },
                cantidad_solicitada: { type: "number", description: "Cantidad solicitada" },
                justificacion: { type: "string", description: "Justificación del item" },
              },
              required: ["medication_id", "workspace_id", "cantidad_solicitada"],
            },
          },
        },
        required: ["titulo", "items"],
      },
    },
  },
  {
    type: "function" as const,
    "function": {
      name: "find_similar_licitaciones",
      description:
        "Busca licitaciones activas existentes que ya incluyan los medicamentos especificados. Usar ANTES de crear una licitación nueva para evitar duplicados.",
      parameters: {
        type: "object",
        properties: {
          medicationIds: {
            type: "array",
            items: { type: "string" },
            description: "IDs de los medicamentos a verificar",
          },
        },
        required: ["medicationIds"],
      },
    },
  },
];

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

export type CreateSaleArgs = {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  price: number;
  prescription?: string;
  doctor?: string;
};

export type CreateDispensationArgs = {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  doctor: string;
  patient: string;
  room: string;
  treatment: string;
};

export type CreateOrderArgs = {
  medicationId: string;
  warehouseId: string;
  quantity: number;
  patient: string;
  room: string;
  reason: string;
  doctorName?: string;
};

export type ProcessOrderArgs = {
  orderId: string;
  action: "aprobar" | "despachar" | "confirmar_recepcion" | "administrar" | "rechazar";
  reason?: string;
};

export type AdvanceTransferArgs = {
  transferId: string;
};

export type RejectTransferArgs = {
  transferId: string;
  reason: string;
  outcome: "devolver" | "descartar";
};

export type ManageMedicationArgs = {
  medicationId?: string;
  name: string;
  activeIngredient: string;
  concentrationValue: number;
  concentrationUnit: "mg" | "mcg" | "ml" | "L" | "g" | "unidad";
  form: string;
  salePrice?: number;
  saleEnabled?: boolean;
};

export type ManageWarehouseArgs = {
  warehouseId?: string;
  name: string;
  type: "central" | "interna" | "ventas";
};

export type ManagePatientArgs = {
  patientId?: string;
  firstName: string;
  lastName: string;
  insurance: string;
  diagnosis: string;
  assignedDoctor: string;
  room: string;
};

export type UpdateStockConfigArgs = {
  medicationId: string;
  warehouseId: string;
  minStock: number;
  optimalStock: number;
};

export type GenerateReportArgs = {
  reportType: "stock" | "expiries" | "movements";
  title?: string;
  periodDays?: number;
};

export type CreateLicitacionArgs = {
  codigo?: string;
  titulo: string;
  descripcion?: string;
  items: {
    medication_id: string;
    workspace_id: string;
    cantidad_solicitada: number;
    justificacion?: string;
  }[];
};

export type FindSimilarLicitacionesArgs = {
  medicationIds: string[];
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

export function parseCreateSaleArgs(raw: unknown): CreateSaleArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const warehouseId = typeof o.warehouseId === "string" ? o.warehouseId.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  if (!medicationId || !warehouseId) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return null;
  if (!Number.isFinite(price) || price <= 0 || price > 9_999_999) return null;
  return {
    medicationId,
    warehouseId,
    quantity: Math.floor(quantity),
    price: Math.round(price * 100) / 100,
    prescription: typeof o.prescription === "string" ? o.prescription.trim() : undefined,
    doctor: typeof o.doctor === "string" ? o.doctor.trim() : undefined,
  };
}

export function parseCreateDispensationArgs(raw: unknown): CreateDispensationArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const warehouseId = typeof o.warehouseId === "string" ? o.warehouseId.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  const doctor = typeof o.doctor === "string" ? o.doctor.trim() : "";
  const patient = typeof o.patient === "string" ? o.patient.trim() : "";
  const room = typeof o.room === "string" ? o.room.trim() : "";
  const treatment = typeof o.treatment === "string" ? o.treatment.trim() : "";
  if (!medicationId || !warehouseId || !doctor || !patient || !room || !treatment) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return null;
  return { medicationId, warehouseId, quantity: Math.floor(quantity), doctor, patient, room, treatment };
}

export function parseCreateOrderArgs(raw: unknown): CreateOrderArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const warehouseId = typeof o.warehouseId === "string" ? o.warehouseId.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
  const patient = typeof o.patient === "string" ? o.patient.trim() : "";
  const room = typeof o.room === "string" ? o.room.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  if (!medicationId || !warehouseId || !patient || !room || !reason) return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return null;
  return {
    medicationId, warehouseId, quantity: Math.floor(quantity), patient, room, reason,
    doctorName: typeof o.doctorName === "string" ? o.doctorName.trim() : undefined,
  };
}

export function parseProcessOrderArgs(raw: unknown): ProcessOrderArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const action = typeof o.action === "string" ? o.action.trim() : "";
  const validActions = ["aprobar", "despachar", "confirmar_recepcion", "administrar", "rechazar"];
  if (!orderId || !validActions.includes(action)) return null;
  return {
    orderId,
    action: action as ProcessOrderArgs["action"],
    reason: typeof o.reason === "string" ? o.reason.trim() : undefined,
  };
}

export function parseAdvanceTransferArgs(raw: unknown): AdvanceTransferArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const transferId = typeof o.transferId === "string" ? o.transferId.trim() : "";
  if (!transferId) return null;
  return { transferId };
}

export function parseRejectTransferArgs(raw: unknown): RejectTransferArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const transferId = typeof o.transferId === "string" ? o.transferId.trim() : "";
  const reason = typeof o.reason === "string" ? o.reason.trim() : "";
  const outcome = typeof o.outcome === "string" ? o.outcome.trim() : "";
  if (!transferId || !reason || !["devolver", "descartar"].includes(outcome)) return null;
  return { transferId, reason, outcome: outcome as RejectTransferArgs["outcome"] };
}

export function parseManageMedicationArgs(raw: unknown): ManageMedicationArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const activeIngredient = typeof o.activeIngredient === "string" ? o.activeIngredient.trim() : "";
  const form = typeof o.form === "string" ? o.form.trim() : "";
  const concentrationUnit = typeof o.concentrationUnit === "string" ? o.concentrationUnit.trim() : "";
  const concentrationValue = typeof o.concentrationValue === "number" ? o.concentrationValue : Number(o.concentrationValue);
  if (!name || !activeIngredient || !form || !["mg", "mcg", "ml", "L", "g", "unidad"].includes(concentrationUnit)) return null;
  if (!Number.isFinite(concentrationValue) || concentrationValue <= 0) return null;
  return {
    medicationId: typeof o.medicationId === "string" ? o.medicationId.trim() : undefined,
    name,
    activeIngredient,
    concentrationValue,
    concentrationUnit: concentrationUnit as ManageMedicationArgs["concentrationUnit"],
    form,
    salePrice: typeof o.salePrice === "number" ? o.salePrice : undefined,
    saleEnabled: typeof o.saleEnabled === "boolean" ? o.saleEnabled : undefined,
  };
}

export function parseManageWarehouseArgs(raw: unknown): ManageWarehouseArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const type = typeof o.type === "string" ? o.type.trim() : "";
  if (!name || !["central", "interna", "ventas"].includes(type)) return null;
  return {
    warehouseId: typeof o.warehouseId === "string" ? o.warehouseId.trim() : undefined,
    name,
    type: type as ManageWarehouseArgs["type"],
  };
}

export function parseManagePatientArgs(raw: unknown): ManagePatientArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : "";
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
  const insurance = typeof o.insurance === "string" ? o.insurance.trim() : "";
  const diagnosis = typeof o.diagnosis === "string" ? o.diagnosis.trim() : "";
  const assignedDoctor = typeof o.assignedDoctor === "string" ? o.assignedDoctor.trim() : "";
  const room = typeof o.room === "string" ? o.room.trim() : "";
  if (!firstName || !lastName || !insurance || !diagnosis || !assignedDoctor || !room) return null;
  return {
    patientId: typeof o.patientId === "string" ? o.patientId.trim() : undefined,
    firstName, lastName, insurance, diagnosis, assignedDoctor, room,
  };
}

export function parseUpdateStockConfigArgs(raw: unknown): UpdateStockConfigArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const medicationId = typeof o.medicationId === "string" ? o.medicationId.trim() : "";
  const warehouseId = typeof o.warehouseId === "string" ? o.warehouseId.trim() : "";
  const minStock = typeof o.minStock === "number" ? o.minStock : Number(o.minStock);
  const optimalStock = typeof o.optimalStock === "number" ? o.optimalStock : Number(o.optimalStock);
  if (!medicationId || !warehouseId) return null;
  if (!Number.isFinite(minStock) || minStock < 0 || minStock > 1_000_000) return null;
  if (!Number.isFinite(optimalStock) || optimalStock < minStock || optimalStock > 1_000_000) return null;
  return { medicationId, warehouseId, minStock: Math.floor(minStock), optimalStock: Math.floor(optimalStock) };
}

export function parseGenerateReportArgs(raw: unknown): GenerateReportArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const reportType = typeof o.reportType === "string" ? o.reportType.trim() : "";
  if (!["stock", "expiries", "movements"].includes(reportType)) return null;
  return {
    reportType: reportType as GenerateReportArgs["reportType"],
    title: typeof o.title === "string" ? o.title.trim() : undefined,
    periodDays: typeof o.periodDays === "number" ? o.periodDays : undefined,
  };
}

export function parseCreateLicitacionArgs(raw: unknown): CreateLicitacionArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const codigo = typeof o.codigo === "string" ? o.codigo.trim() : "";
  const titulo = typeof o.titulo === "string" ? o.titulo.trim() : "";
  if (!titulo) return null;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw
    .map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const medication_id = typeof i.medication_id === "string" ? i.medication_id.trim() : "";
      const workspace_id = typeof i.workspace_id === "string" ? i.workspace_id.trim() : "";
      const cantidad_solicitada = typeof i.cantidad_solicitada === "number" ? i.cantidad_solicitada : 0;
      if (!medication_id || !workspace_id || cantidad_solicitada <= 0) return null;
      return {
        medication_id,
        workspace_id,
        cantidad_solicitada,
        justificacion: typeof i.justificacion === "string" ? i.justificacion.trim() : "",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) return null;
  return {
    codigo,
    titulo,
    descripcion: typeof o.descripcion === "string" ? o.descripcion.trim() : "",
    items,
  };
}

export function parseFindSimilarLicitacionesArgs(raw: unknown): FindSimilarLicitacionesArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.medicationIds) || o.medicationIds.length === 0) return null;
  const medicationIds = o.medicationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (medicationIds.length === 0) return null;
  return { medicationIds };
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
  if (!/"name"\s*:\s*"(navigate|create_transfer|render_chart|add_stock|list_users|create_user|delete_user|create_sale|create_dispensation|create_order|process_order|advance_transfer|reject_transfer|manage_medication|manage_warehouse|manage_patient|update_stock_config|generate_report|create_licitacion|find_similar_licitaciones)"/i.test(t)) return content;
  const chunks = splitConcatenatedJsonObjects(t);
  let toolish = 0;
  for (const ch of chunks) {
    try {
      const o = JSON.parse(ch) as { name?: string };
      if (o && typeof o === "object" && ["navigate", "create_transfer", "render_chart", "add_stock", "list_users", "create_user", "delete_user", "create_sale", "create_dispensation", "create_order", "process_order", "advance_transfer", "reject_transfer", "manage_medication", "manage_warehouse", "manage_patient", "update_stock_config", "generate_report", "create_licitacion", "find_similar_licitaciones"].includes(o.name ?? "")) toolish++;
      else return content;
    } catch {
      if (chunks.length > 1 && t.length < 4000 && /"name"\s*:\s*"(navigate|create_transfer|add_stock|list_users|create_user|delete_user|create_sale|create_dispensation|create_order|process_order|advance_transfer|reject_transfer|manage_medication|manage_warehouse|manage_patient|update_stock_config|generate_report|create_licitacion|find_similar_licitaciones)"/i.test(t)) {
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Bot, Loader2, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChartRenderer } from "@/components/chart-renderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildWorkspaceAssistantContext, answerStockQueryFromSnapshot, answerTransferPipelineFromSnapshot, type AssistantWorkspaceSnapshotInput } from "@/lib/assistant-workspace-context";
import {
  isExplicitTransferCreationIntent,
  isQuantityQuestionWithoutNavIntent,
  isTransferPipelineInfoQuestion,
  isWeakModelStockReply,
} from "@/lib/assistant-chat-intent";
import {
  assistantTools,
  extractLegacyToolBlocks,
  navigateToolToOptions,
  parseCreateTransferArgs,
  parseNavigateArgs,
  parseOllamaToolArguments,
  parseRenderChartArgs,
  parseAddStockArgs,
  parseListUsersArgs,
  parseCreateUserArgs,
  parseDeleteUserArgs,
  stripBareToolJsonFromAssistantContent,
  validateTransferAgainstBatches,
  type ChartSpec,
  type CreateTransferToolArgs,
  type OllamaToolCall,
  type AddStockArgs,
  type CreateUserArgs,
  type DeleteUserArgs,
} from "@/lib/assistant-tools";
import { streamAiChat, type ChatMessage } from "@/lib/ai-chat";
import { medName, warehouseName } from "@/lib/domain-types";
import { useStore } from "@/lib/store";

const MODULE_KNOWLEDGE = `
## Módulos del sistema Meditory

### /app/inventario — Inventario / Stock
Ver y filtrar el stock actual por depósito. Permite ver lotes, vencimientos, y cantidad disponible. Acceso: admin, técnico.

### /app/ingresos — Ingresos de Stock
Registrar entrada de mercadería (compras o ajustes). Genera movimiento tipo "ingreso". Acceso: admin, técnico.

### /app/transferencias — Transferencias Internas
Mover stock entre depósitos del mismo hospital. Flujo: origen → depósito destino → confirmación. Acceso: admin, técnico.

### /app/vencimientos — Control de Vencimientos
Listado de batches próximos a vencer. Filtra por días restantes. Acceso: todos.

### /app/dispensacion — Dispensación
Entrega de medicamentos a pacientes o salas. Genera movimiento tipo "dispensacion". Acceso: admin, técnico, operador.

### /app/ventas — Ventas al Público
Venta directa al mostrador. Genera movimiento tipo "venta". Acceso: admin.

### /app/lista-precios — Lista de Precios
Ver y editar precios de venta de medicamentos. Acceso: admin.

### /app/auditoria — Auditoría
Historial completo de movimientos con filtros por fecha, tipo y usuario. Acceso: admin.

### /app/usuarios — Usuarios
ABM de usuarios de la institución. Roles: admin, técnico, operador. Acceso: admin.

### /app/catalogo — Catálogo de Medicamentos
Ver y editar el catálogo de medicamentos registrados. Acceso: admin.

### /app/depositos — Depósitos
Configurar los depósitos del hospital (nombre, tipo, capacidad). Acceso: admin.

### /app/pacientes — Pacientes / Internados
Gestión de pacientes internados para dispensación controlada. Acceso: admin, técnico.

### /app/pedidos — Pedidos a Proveedores
Crear y seguir órdenes de compra a proveedores externos. Acceso: admin.
`;

const SYSTEM_INSTRUCTIONS = `Sos **Medi**, el asistente virtual de Meditory — gestión farmacéutica hospitalaria.

TONO: hablá siempre en **español** claro, cordial y profesional, como un/a colega de farmacia hospitalaria: empático, respetuoso y tranquilo. No des diagnósticos ni indicaciones clínicas al paciente; orientás sobre **operaciones y datos del sistema** (stock, transferencias, pedidos, etc.).

FORMATO: respondé en **prosa** (oraciones). **Nunca** devuelvas solo JSON, bloques de herramienta sueltos ni cadenas tipo \`{"name":"navigate"…};{"name":"create_transfer"…}\`. Si usás datos numéricos, copiá cifras coherentes con el snapshot.

HERRAMIENTAS disponibles:
1) **navigate** — SOLO si el usuario pidió explícitamente ir, abrir, mostrar o entrar a una pantalla. Rutas internas válidas empiezan con **/app/** (ej. /app/transferencias).
2) **create_transfer** — SOLO si el usuario pidió explícitamente "transferir", "mover", "crear transferencia" o "solicitar traslado" entre depósitos.
3) **render_chart** — SOLO si el usuario pidió explícitamente "mostrar gráfico", "graficar", "chart", "pastel", "barras", "torta". Tipos: bar, pie, area, line. Incluí title y data [{name, value}]. Máximo 20 ítems.
4) **add_stock** — SOLO si el usuario pidió explícitamente agregar, cargar o aumentar stock. Usá los IDs reales del snapshot. Si un medicamento existe en múltiples lotes/depósitos, preguntar cuál corresponde.
5) **list_users** — Cuando el usuario pregunte por usuarios, empleados o personal del hospital.
6) **create_user** — SOLO si el usuario pidió explícitamente crear/agregar un usuario con nombre, email, rol.
7) **delete_user** — SOLO si el usuario pidió explícitamente eliminar/borrar un usuario. Requiere confirmación.

Consultas **solo informativas** (cantidades, listados, estados): respondé con texto desde el snapshot; **no** llames herramientas.

Para agregar stock: usar SIEMPRE la tool add_stock con los IDs del snapshot. Si hay múltiples lotes o depósitos, preguntar en texto cuál corresponde y luego llamar la tool.

Si no tenés datos suficientes, decilo y sugerí la pantalla correspondiente según el caso.`;

type UiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "chart"; spec: ChartSpec }
  | { role: "action_result"; success: boolean; message: string }
  | { role: "pending_confirm"; label: string; toolName: string; data: unknown };

function buildWorkspaceSystemPrompt(snapshotJson: string, users: { id: string; name: string; email: string; role: string; workspaceId: string }[]): string {
  const usersText = users.length > 0
    ? `\n\n### Usuarios de la institución\n${users.map((u) => `- ${u.name} <${u.email}> rol:${u.role} (id: ${u.id})`).join("\n")}`
    : "";

  return `${SYSTEM_INSTRUCTIONS}\n\n${MODULE_KNOWLEDGE}\n\n### Datos de la institución (IDs para acciones)\n\ninstitucion_snapshot:\n${snapshotJson}${usersText}`;
}

const WELCOME_MSG: UiMessage = { role: "assistant", content: "Hola, soy **Medi**, el asistente del sistema Meditory. Preguntame sobre stock, usuarios, o lo que necesites de la institución actual." };

function PendingConfirmBubble({
  msg,
  onConfirm,
  onCancel,
}: {
  msg: { label: string; toolName: string; data: unknown };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-3 text-sm">
      <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">¿Confirmar acción?</p>
      <p className="text-yellow-700 dark:text-yellow-400 mb-3">{msg.label}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700"
        >
          Confirmar
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-yellow-300 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

async function executeConfirmedAction(
  toolName: string,
  data: unknown,
  addMsg: (m: UiMessage) => void,
  setFullSnapshot: (snapshot: any) => void,
) {
  try {
    const rpc = await import("@/lib/server-rpc");
    switch (toolName) {
      case "add_stock": {
        const args = data as AddStockArgs;
        if (args.registerAsPurchase) {
          await rpc.backofficeAddStockWithPurchaseRpc({
            data: {
              medicationId: args.medicationId,
              warehouseId: args.warehouseId,
              quantity: args.quantity,
              lot: args.lot,
              expiry: args.expiry,
              invoiceRef: args.invoiceRef,
            }
          });
        } else {
          await rpc.backofficeAddStockDirectlyRpc({
            data: {
              medicationId: args.medicationId,
              warehouseId: args.warehouseId,
              quantity: args.quantity,
              lot: args.lot,
              expiry: args.expiry,
            }
          });
        }
        addMsg({ role: "action_result", success: true, message: `Stock actualizado: +${args.quantity} unidades agregadas correctamente.` });
        break;
      }
      case "create_user": {
        const args = data as CreateUserArgs;
        await rpc.backofficeCreateUserRpc({
          data: {
            workspaceId: args.workspaceId,
            name: args.name,
            email: args.email,
            role: args.role,
            warehouseIds: [],
          }
        });
        addMsg({ role: "action_result", success: true, message: `Usuario "${args.name}" creado correctamente.` });
        break;
      }
      case "delete_user": {
        const args = data as DeleteUserArgs;
        await rpc.backofficeDeleteUserRpc({ data: { id: args.userId } });
        addMsg({ role: "action_result", success: true, message: "Usuario eliminado correctamente." });
        break;
      }
      default:
        addMsg({ role: "action_result", success: false, message: "Acción desconocida." });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    addMsg({ role: "action_result", success: false, message: `Error al ejecutar: ${msg}` });
  }
}

/** Si el modelo devuelve solo un JSON de "herramienta" inventada, reemplazar por mensaje útil. */
function sanitizeHallucinatedToolOnlyReply(content: string): string {
  const t = content.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return content;
  try {
    const o = JSON.parse(t) as { name?: string };
    if (typeof o.name !== "string") return content;
    if (o.name === "navigate" || o.name === "create_transfer" || o.name === "render_chart") return content;
    return (
      `No existe la herramienta «${o.name}». Solo están disponibles **navigate**, **create_transfer** y **render_chart**. ` +
      `Para saber unidades de un medicamento hay que leer el JSON del snapshot (campo **stockByMedicationId** y **batchesSample**) y responder en texto con la cantidad. ` +
      `Probá de nuevo preguntando sin pedir una función inventada, o revisá Inventario en la app.`
    );
  } catch {
    return content;
  }
}

function processToolCalls(
  toolCalls: OllamaToolCall[],
  navigate: ReturnType<typeof useNavigate>,
  batches: AssistantWorkspaceSnapshotInput["batches"],
  onCreateTransfer: (args: CreateTransferToolArgs) => void,
  onChart: (spec: ChartSpec) => void,
  addMsg: (m: UiMessage) => void,
  users: { id: string; name: string; email: string; role: string; workspaceId: string }[],
  opts?: { suppressNavigate?: boolean; suppressCreateTransfer?: boolean },
): string[] {
  const lines: string[] = [];
  for (const tc of toolCalls) {
    const name = tc.function?.name;
    const raw = parseOllamaToolArguments(tc);
    if (name === "navigate") {
      if (opts?.suppressNavigate) {
        lines.push("_(Navegación no ejecutada: la pregunta era informativa.)_");
        continue;
      }
      const args = parseNavigateArgs(raw);
      if (!args) {
        lines.push("Navegación rechazada: ruta o parámetros no válidos.");
        continue;
      }
      void navigate(navigateToolToOptions(args));
      lines.push(`Navegación: ${args.path}${args.search ? ` (${JSON.stringify(args.search)})` : ""}.`);
    } else if (name === "create_transfer") {
      if (opts?.suppressCreateTransfer) {
        lines.push(
          "_(No se abrió solicitud de transferencia: tu mensaje no incluye un pedido explícito de crear/solicitar transferencia.)_",
        );
        continue;
      }
      const args = parseCreateTransferArgs(raw);
      if (!args) {
        lines.push("Transferencia no solicitada: argumentos inválidos.");
        continue;
      }
      const err = validateTransferAgainstBatches(args, batches);
      if (err) {
        lines.push(`Transferencia no confirmada: ${err}`);
        continue;
      }
      onCreateTransfer(args);
      lines.push("Se abrió el diálogo de confirmación para la transferencia.");
    } else if (name === "render_chart") {
      const args = parseRenderChartArgs(raw);
      if (!args) {
        lines.push("Gráfico no generado: argumentos inválidos.");
        continue;
      }
      onChart(args);
      lines.push("_(Gráfico generado arriba.)_");
    } else if (name === "add_stock") {
      const args = parseAddStockArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para agregar stock." });
      } else {
        const label = `Agregar ${args.quantity} u. al depósito especificado${args.registerAsPurchase ? " — registrar como compra" : ""}`;
        addMsg({ role: "pending_confirm", label, toolName: "add_stock", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "list_users") {
      const args = parseListUsersArgs(raw);
      const filtered = args.workspaceId
        ? users.filter((u) => u.workspaceId === args.workspaceId)
        : users;
      const text = filtered.length === 0
        ? "No se encontraron usuarios."
        : filtered.map((u) => `• **${u.name}** — ${u.email} | rol: ${u.role}`).join("\n");
      addMsg({ role: "assistant", content: text });
      lines.push("_(Listado de usuarios generado.)_");
    } else if (name === "create_user") {
      const args = parseCreateUserArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para crear usuario." });
      } else {
        const label = `Crear usuario "${args.name}" <${args.email}> con rol "${args.role}"`;
        addMsg({ role: "pending_confirm", label, toolName: "create_user", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "delete_user") {
      const args = parseDeleteUserArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "ID de usuario inválido." });
      } else {
        const user = users.find((u) => u.id === args.userId);
        const label = `Eliminar usuario "${user?.name ?? args.userId}" <${user?.email ?? ""}>`;
        addMsg({ role: "pending_confirm", label, toolName: "delete_user", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else {
      lines.push(`Herramienta desconocida ignorada: ${name ?? "?"}`);
    }
  }
  return lines;
}

function processLegacyTools(
  tools: { name: string; args: unknown }[],
  navigate: ReturnType<typeof useNavigate>,
  batches: AssistantWorkspaceSnapshotInput["batches"],
  onCreateTransfer: (args: CreateTransferToolArgs) => void,
  onChart: (spec: ChartSpec) => void,
  opts?: { suppressNavigate?: boolean; suppressCreateTransfer?: boolean },
): string[] {
  const lines: string[] = [];
  for (const t of tools) {
    if (t.name === "navigate") {
      if (opts?.suppressNavigate) {
        lines.push("Navegación legacy omitida (pregunta informativa).");
        continue;
      }
      const args = parseNavigateArgs(t.args);
      if (!args) {
        lines.push("Navegación rechazada (bloque legacy).");
        continue;
      }
      void navigate(navigateToolToOptions(args));
      lines.push(`Navegación: ${args.path}.`);
    } else if (t.name === "create_transfer") {
      if (opts?.suppressCreateTransfer) {
        lines.push("Transferencia legacy omitida (sin pedido explícito).");
        continue;
      }
      const args = parseCreateTransferArgs(t.args);
      if (!args) {
        lines.push("Transferencia inválida (bloque legacy).");
        continue;
      }
      const err = validateTransferAgainstBatches(args, batches);
      if (err) {
        lines.push(`Transferencia: ${err}`);
        continue;
      }
      onCreateTransfer(args);
      lines.push("Diálogo de confirmación de transferencia.");
    } else if (t.name === "render_chart") {
      const args = parseRenderChartArgs(t.args);
      if (!args) {
        lines.push("Gráfico legacy: argumentos inválidos.");
        continue;
      }
      onChart(args);
      lines.push("_(Gráfico legacy generado.)_");
    }
  }
  return lines;
}

export function WorkspaceAssistantChat({
  snapshotInput,
}: {
  snapshotInput: AssistantWorkspaceSnapshotInput;
}) {
  const navigate = useNavigate();
  const createTransfer = useStore((s) => s.createTransfer);
  const batches = useStore((s) => s.batches);
  const aiProvider = useStore((s) => s.aiProvider);
  const storedMessages = useStore((s) => s.chatMessages);
  const setStoredMessages = useStore((s) => s.setChatMessages);
  const storeUsers = useStore((s) => s.users);
  const session = useStore((s) => s.session);

  const [messages, setMessages] = useState<UiMessage[]>(() =>
    storedMessages.length > 0
      ? storedMessages.map((m) => ({ role: m.role, content: m.content })) as UiMessage[]
      : [WELCOME_MSG],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<CreateTransferToolArgs | null>(null);
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chartGeneratedRef = useRef(false);

  const snapshotJson = useMemo(() => buildWorkspaceAssistantContext(snapshotInput), [snapshotInput]);
  const workspaceUsers = useMemo(
    () => storeUsers.filter((u) => u.workspaceId === session?.workspaceId),
    [storeUsers, session?.workspaceId],
  );

  const openTransferDialog = useCallback((args: CreateTransferToolArgs) => {
    setPendingTransfer(args);
  }, []);

  const addChart = useCallback((spec: ChartSpec) => {
    chartGeneratedRef.current = true;
    setMessages((m) => [...m, { role: "chart", spec }]);
  }, []);

  // Persistir solo mensajes de texto al store
  useEffect(() => {
    const textMessages = messages
      .filter((m) => m.role !== "chart" && m.role !== "action_result" && m.role !== "pending_confirm")
      .filter((m): m is { role: "user" | "assistant"; content: string } => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    setStoredMessages(textMessages);
  }, [messages, setStoredMessages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: UiMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamingText("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const recentMessages = messages.slice(-12);
      const history: ChatMessage[] = [
        { role: "system", content: buildWorkspaceSystemPrompt(snapshotJson, workspaceUsers) },
        ...recentMessages.flatMap((msg): ChatMessage[] =>
          msg.role === "user"
            ? [{ role: "user", content: msg.content }]
            : msg.role === "chart" || msg.role === "pending_confirm" || msg.role === "action_result"
            ? []
            : [{ role: "assistant", content: msg.content }],
        ),
        { role: "user", content: text },
      ];

      let fullContent = "";
      const collectedToolCalls: OllamaToolCall[] = [];

      const aiProvider = useStore.getState().aiProvider;
      const model = aiProvider === "zen" ? "big-pickle" : "llama3.1:8b";

      for await (const event of streamAiChat({
        model,
        messages: history,
        tools: assistantTools,
        signal: ac.signal,
        provider: aiProvider,
      })) {
        if (event.type === "text") {
          fullContent += event.content;
          setStreamingText(fullContent);
        } else if (event.type === "tool_calls") {
          for (const tc of event.tool_calls) {
            const existing = collectedToolCalls.find(
              (e) => (e.function?.name ?? "") === (tc.function?.name ?? ""),
            );
            if (existing) {
              if (typeof tc.function?.arguments === "string") {
                if (typeof existing.function?.arguments === "string") {
                  existing.function.arguments += tc.function.arguments;
                }
              }
            } else {
              collectedToolCalls.push(tc);
            }
          }
        } else if (event.type === "error") {
          toast.error("Error al consultar el asistente", { description: event.message.slice(0, 280) });
          setMessages((m) => [...m, { role: "assistant", content: `No pude obtener respuesta: ${event.message}` }]);
          setStreaming(false);
          setStreamingText("");
          return;
        }
      }

      let content = stripBareToolJsonFromAssistantContent(fullContent.trim() ?? "");
      const toolCalls = collectedToolCalls;

      const transferInfoQ = isTransferPipelineInfoQuestion(text);
      const suppressNavigate =
        isQuantityQuestionWithoutNavIntent(text) || transferInfoQ;
      const suppressCreateTransfer = !isExplicitTransferCreationIntent(text);
      const actionLines = processToolCalls(toolCalls, navigate, batches, openTransferDialog, addChart, (m) => setMessages((prev) => [...prev, m]), workspaceUsers, {
        suppressNavigate,
        suppressCreateTransfer,
      });

      const legacy = extractLegacyToolBlocks(content);
      content = legacy.cleanContent;
      actionLines.push(
        ...processLegacyTools(legacy.tools, navigate, batches, openTransferDialog, addChart, {
          suppressNavigate,
          suppressCreateTransfer,
        }),
      );

      const suffix = actionLines.length > 0 ? `\n\n_${actionLines.join(" ")}_` : "";
      let assistantText = sanitizeHallucinatedToolOnlyReply(content || "Listo.") + suffix;

      if (suppressNavigate && isWeakModelStockReply(assistantText)) {
        let fill: string | null = null;
        if (transferInfoQ) {
          fill = answerTransferPipelineFromSnapshot(snapshotInput, text);
        } else {
          fill = answerStockQueryFromSnapshot(snapshotInput, text);
        }
        if (fill) {
          assistantText = `${fill}\n\n_(Cifras y listados calculados en la app a partir de los datos visibles en tu sesión.)_`;
        } else if (isQuantityQuestionWithoutNavIntent(text) && !transferInfoQ) {
          assistantText =
            `No pude emparejar tu consulta con un medicamento en el stock visible (o el modelo no devolvió cifras). ` +
            `Probá con el nombre exacto del catálogo o revisá **Inventario**.`;
        }
      }

      if (chartGeneratedRef.current) {
        assistantText = `Acá tenés el gráfico con los datos solicitados.` + suffix;
      }

      chartGeneratedRef.current = false;

      setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (err.includes("abort") || err.includes("Abort")) return;
      chartGeneratedRef.current = false;
      toast.error("Error al consultar el asistente", { description: err.slice(0, 280) });
      setMessages((m) => [...m, { role: "assistant", content: `No pude obtener respuesta: ${err}` }]);
    } finally {
      setStreaming(false);
      setStreamingText("");
      abortRef.current = null;
    }
  }, [input, streaming, messages, snapshotJson, snapshotInput, navigate, batches, openTransferDialog, addChart, workspaceUsers]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingText) {
      setMessages((m) => [...m, { role: "assistant", content: streamingText + "\n\n_(Generación interrumpida por el usuario.)_" }]);
    }
    setStreaming(false);
    setStreamingText("");
    abortRef.current = null;
  }, [streamingText]);

  const confirmTransfer = useCallback(async () => {
    if (!pendingTransfer) return;
    setConfirming(true);
    try {
      await createTransfer(pendingTransfer);
      toast.success("Transferencia solicitada");
      setPendingTransfer(null);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo crear la transferencia", { description: err.slice(0, 240) });
    } finally {
      setConfirming(false);
    }
  }, [pendingTransfer, createTransfer]);

  function renderText(text: string) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  }

  return (
    <div className="flex min-h-[420px] flex-col gap-3">
      <div className="min-h-[280px] max-h-[min(55vh,520px)] flex-1 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
        {messages.map((msg, i) => {
          if (msg.role === "chart") {
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mr-auto max-w-[95%]">
                <ChartRenderer spec={msg.spec} />
              </motion.div>
            );
          }
          if (msg.role === "action_result") {
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-lg p-3 text-sm ${msg.success ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300" : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"}`}>
                {msg.success ? "✓ " : "✗ "}{msg.message}
              </motion.div>
            );
          }
          if (msg.role === "pending_confirm") {
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PendingConfirmBubble
                  msg={msg}
                  onConfirm={() => {
                    executeConfirmedAction(msg.toolName, msg.data, (m) => {
                      setMessages((prev) => [...prev, m]);
                    }, () => {});
                    setMessages((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  onCancel={() => {
                    setMessages((prev) => prev.filter((_, idx) => idx !== i));
                    setMessages((prev) => [...prev, { role: "assistant", content: "Acción cancelada." }]);
                  }}
                />
              </motion.div>
            );
          }
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-0.5 shrink-0">
                  <Bot size={12} className="text-primary" />
                </div>
              )}
              <div
                className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                {msg.content.split("\n").map((line, j) => (
                  <span key={j}>{renderText(line)}{j < msg.content.split("\n").length - 1 && <br />}</span>
                ))}
              </div>
            </motion.div>
          );
        })}
        {streaming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-0.5 shrink-0">
              <Bot size={12} className="text-primary" />
            </div>
            <div className="max-w-[95%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm bg-muted leading-relaxed">
              <span className="whitespace-pre-wrap break-words">{streamingText || ""}</span>
              <span className="inline-block w-1 h-3 ml-0.5 bg-primary animate-pulse rounded" />
            </div>
          </motion.div>
        )}
        {streaming && !streamingText && (
          <div className="flex justify-start items-center gap-1 ml-8">
            {[0, 0.15, 0.3].map((delay, idx) => (
              <motion.div key={idx} className="w-2 h-2 rounded-full bg-muted-foreground/40"
                animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay }} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          placeholder="Ej.: ¿Cuántas unidades tenemos de paracetamol? ¿Hay lotes críticos?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          disabled={streaming}
          className="min-h-[80px] flex-1 resize-y"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        {streaming ? (
          <Button type="button" variant="destructive" onClick={handleStop} className="shrink-0">
            <StopCircle className="h-4 w-4" />
            <span className="ml-2">Detener</span>
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleSend()} disabled={!input.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
            <span className="ml-2">Enviar</span>
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Asistente vía <code className="rounded bg-muted px-0.5">{aiProvider === "zen" ? "OpenCode Zen" : "Groq"}</code>{" "}
        (modelo: <span className="font-mono">{aiProvider === "zen" ? "big-pickle" : "llama3.1:8b"}</span>).
        <span className="ml-2 text-amber-500">
          {aiProvider === "groq" ? "Free-tier ~12k tokens/min" : "Modelos gratuitos"}
        </span>
      </p>

      <Dialog open={!!pendingTransfer} onOpenChange={(o) => !o && !confirming && setPendingTransfer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar transferencia</DialogTitle>
            <DialogDescription>
              El asistente solicitó crear una transferencia. Revisá los datos antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          {pendingTransfer && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Medicamento: </span>
                {medName(pendingTransfer.medicationId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Origen: </span>
                {warehouseName(pendingTransfer.fromWarehouseId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Destino: </span>
                {warehouseName(pendingTransfer.toWarehouseId)}
              </li>
              <li>
                <span className="font-medium text-foreground">Cantidad: </span>
                {pendingTransfer.quantity} u
              </li>
              <li className="font-mono text-xs">Lote (batch): {pendingTransfer.sourceBatchId}</li>
            </ul>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPendingTransfer(null)} disabled={confirming}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmTransfer()} disabled={confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar transferencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

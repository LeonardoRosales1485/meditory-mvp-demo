import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Bot, Loader2, Send, StopCircle, Lightbulb, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  isSaleIntent,
  isDispensationIntent,
  isOrderIntent,
  isWorkflowResponse,
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
  parseCreateSaleArgs,
  parseCreateDispensationArgs,
  parseCreateOrderArgs,
  parseProcessOrderArgs,
  parseAdvanceTransferArgs,
  parseRejectTransferArgs,
  parseManageMedicationArgs,
  parseManageWarehouseArgs,
  parseManagePatientArgs,
  parseUpdateStockConfigArgs,
  parseGenerateReportArgs,
  stripBareToolJsonFromAssistantContent,
  validateTransferAgainstBatches,
  type ChartSpec,
  type CreateTransferToolArgs,
  type OllamaToolCall,
  type AddStockArgs,
  type CreateUserArgs,
  type DeleteUserArgs,
  type CreateSaleArgs,
  type CreateDispensationArgs,
  type CreateOrderArgs,
  type ProcessOrderArgs,
  type AdvanceTransferArgs,
  type RejectTransferArgs,
  type ManageMedicationArgs,
  type ManageWarehouseArgs,
  type ManagePatientArgs,
  type UpdateStockConfigArgs,
  type GenerateReportArgs,
} from "@/lib/assistant-tools";
import { getTopSuggestions, type Suggestion, type ProactivityInput } from "@/lib/assistant-proactivity";
import {
  WORKFLOWS,
  getCurrentStepPrompt,
  validateWorkflowStep,
  advanceWorkflow,
  type ActiveWorkflow,
  type WorkflowContext,
} from "@/lib/assistant-workflows";
import { generateStockReport, generateExpiriesReport, generateMovementsReport, downloadReport, type ReportData } from "@/lib/assistant-reports";
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
1) **navigate** — SOLO si el usuario pidió explícitamente ir, abrir, mostrar o entrar a una pantalla.
2) **create_transfer** — SOLO si el usuario pidió explícitamente "transferir", "mover", "crear transferencia" o "solicitar traslado" entre depósitos.
3) **render_chart** — SOLO si el usuario pidió explícitamente "mostrar gráfico", "graficar", "chart", "pastel", "barras", "torta".
4) **add_stock** — SOLO si el usuario pidió explícitamente agregar, cargar o aumentar stock.
5) **list_users** — Cuando el usuario pregunte por usuarios, empleados o personal del hospital.
6) **create_user** — SOLO si el usuario pidió explícitamente crear/agregar un usuario.
7) **delete_user** — SOLO si el usuario pidió explícitamente eliminar/borrar un usuario.
8) **create_sale** — SOLO si el usuario pidió explícitamente vender, cobrar o facturar un medicamento. Incluir medicationId, warehouseId, quantity, price.
9) **create_dispensation** — SOLO si el usuario pidió explícitamente dispensar, entregar o administrar medicación a un paciente.
10) **create_order** — SOLO si el usuario pidió explícitamente pedir, solicitar o crear un pedido de medicación desde una sala.
11) **process_order** — SOLO si el usuario pidió explícitamente aprobar, despachar, recibir o administrar un pedido existente.
12) **advance_transfer** — SOLO si el usuario pidió explícitamente autorizar, despachar, recibir o aceptar una transferencia.
13) **reject_transfer** — SOLO si el usuario pidió explícitamente rechazar, cancelar o devolver una transferencia.
14) **manage_medication** — SOLO si el usuario pidió explícitamente agregar, crear o editar un medicamento.
15) **manage_warehouse** — SOLO si el usuario pidió explícitamente agregar, crear o editar un depósito.
16) **manage_patient** — SOLO si el usuario pidió explícitamente internar, registrar o modificar un paciente.
17) **update_stock_config** — SOLO si el usuario pidió explícitamente configurar stock mínimo/óptimo.
18) **generate_report** — SOLO si el usuario pidió explícitamente generar, descargar o exportar un reporte PDF.
19) **list_users** — Cuando el usuario pregunte por usuarios.

Consultas **solo informativas** (cantidades, listados, estados): respondé con texto desde el snapshot; **no** llames herramientas.

Para acciones con varios pasos (venta, dispensación, pedido): SIEMPRE guiá al usuario paso a paso. Preguntá cada dato de a uno, confirmá antes de ejecutar.

Si no tenés datos suficientes, decilo y sugerí la pantalla correspondiente según el caso.`;

type UiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "chart"; spec: ChartSpec }
  | { role: "action_result"; success: boolean; message: string }
  | { role: "pending_confirm"; label: string; toolName: string; data: unknown };

function buildWorkspaceSystemPrompt(snapshotJson: string, users: { id: string; name: string; email: string; role: string; workspaceId: string }[], snapshotInput: AssistantWorkspaceSnapshotInput): string {
  const usersText = users.length > 0
    ? `\n\n### Usuarios de la institución\n${users.map((u) => `- ${u.name} <${u.email}> rol:${u.role} (id: ${u.id})`).join("\n")}`
    : "";

  let extra = "";
  if (snapshotInput.orders && snapshotInput.orders.length > 0) {
    const pending = snapshotInput.orders.filter((o) => o.status === "pendiente");
    if (pending.length > 0) {
      extra += `\n\n### Pedidos pendientes (${pending.length})\n`;
      extra += pending.slice(0, 5).map((o) =>
        `- ${snapshotInput.medications.find((m) => m.id === o.medicationId)?.name ?? o.medicationId}: ${o.quantity} u. para ${o.patient} (${o.room}) — estado: ${o.status}`
      ).join("\n");
    }
  }
  if (snapshotInput.patients && snapshotInput.patients.length > 0) {
    extra += `\n\n### Pacientes internados (${snapshotInput.patients.length})\n`;
    extra += snapshotInput.patients.slice(0, 5).map((p) =>
      `- ${p.firstName} ${p.lastName} — sala: ${p.room} — médico: ${p.assignedDoctor}`
    ).join("\n");
  }

  return `${SYSTEM_INSTRUCTIONS}\n\n${MODULE_KNOWLEDGE}\n\n### Datos de la institución (IDs para acciones)\n\ninstitucion_snapshot:\n${snapshotJson}${usersText}${extra}`;
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
      case "create_sale": {
        const args = data as CreateSaleArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().addSale({
          medicationId: args.medicationId,
          warehouseId: args.warehouseId,
          quantity: args.quantity,
          price: args.price,
          prescription: args.prescription,
        });
        addMsg({ role: "action_result", success: true, message: `Venta registrada: ${args.quantity} u. por $${(args.price * args.quantity).toLocaleString("es-AR")}.` });
        break;
      }
      case "create_dispensation": {
        const args = data as CreateDispensationArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().addDispensation({
          medicationId: args.medicationId,
          warehouseId: args.warehouseId,
          quantity: args.quantity,
          doctor: args.doctor,
          patient: args.patient,
          room: args.room,
          treatment: args.treatment,
        });
        addMsg({ role: "action_result", success: true, message: `Dispensación registrada: ${args.quantity} u. a ${args.patient}.` });
        break;
      }
      case "create_order": {
        const args = data as CreateOrderArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().createOrder({
          medicationId: args.medicationId,
          sourceBatchId: "",
          warehouseId: args.warehouseId,
          quantity: args.quantity,
          patient: args.patient,
          room: args.room,
          reason: args.reason,
          doctorName: args.doctorName,
        });
        addMsg({ role: "action_result", success: true, message: `Pedido creado: ${args.quantity} u. para ${args.patient}.` });
        break;
      }
      case "process_order": {
        const args = data as ProcessOrderArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().processOrder(args.orderId, args.action, args.reason);
        addMsg({ role: "action_result", success: true, message: `Pedido ${args.action}: ${args.orderId}.` });
        break;
      }
      case "advance_transfer": {
        const args = data as AdvanceTransferArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().advanceTransfer(args.transferId);
        addMsg({ role: "action_result", success: true, message: `Transferencia avanzada: ${args.transferId}.` });
        break;
      }
      case "reject_transfer": {
        const args = data as RejectTransferArgs;
        const store = await import("@/lib/store");
        await store.useStore.getState().rejectTransfer(args.transferId, args.reason, args.outcome);
        addMsg({ role: "action_result", success: true, message: `Transferencia ${args.outcome === "devolver" ? "devuelta" : "descartada"}: ${args.transferId}.` });
        break;
      }
      case "manage_medication": {
        const args = data as ManageMedicationArgs;
        const store = await import("@/lib/store");
        if (args.medicationId) {
          await store.useStore.getState().updateMedication(args.medicationId, {
            name: args.name,
            activeIngredient: args.activeIngredient,
            concentrationValue: args.concentrationValue,
            concentrationUnit: args.concentrationUnit,
            form: args.form,
            salePrice: args.salePrice,
          });
          addMsg({ role: "action_result", success: true, message: `Medicamento "${args.name}" actualizado.` });
        } else {
          await store.useStore.getState().addMedication({
            name: args.name,
            activeIngredient: args.activeIngredient,
            concentrationValue: args.concentrationValue,
            concentrationUnit: args.concentrationUnit,
            form: args.form,
            salePrice: args.salePrice ?? 0,
          });
          addMsg({ role: "action_result", success: true, message: `Medicamento "${args.name}" creado.` });
        }
        break;
      }
      case "manage_warehouse": {
        const args = data as ManageWarehouseArgs;
        const store = await import("@/lib/store");
        if (args.warehouseId) {
          await store.useStore.getState().updateWarehouse(args.warehouseId, { name: args.name, type: args.type });
          addMsg({ role: "action_result", success: true, message: `Depósito "${args.name}" actualizado.` });
        } else {
          await store.useStore.getState().addWarehouse({ name: args.name, type: args.type });
          addMsg({ role: "action_result", success: true, message: `Depósito "${args.name}" creado.` });
        }
        break;
      }
      case "manage_patient": {
        const args = data as ManagePatientArgs;
        const store = await import("@/lib/store");
        if (args.patientId) {
          await store.useStore.getState().updatePatient(args.patientId, {
            firstName: args.firstName,
            lastName: args.lastName,
            insurance: args.insurance,
            diagnosis: args.diagnosis,
            assignedDoctor: args.assignedDoctor,
            room: args.room,
          });
          addMsg({ role: "action_result", success: true, message: `Paciente ${args.firstName} ${args.lastName} actualizado.` });
        } else {
          await store.useStore.getState().addPatient({
            firstName: args.firstName,
            lastName: args.lastName,
            insurance: args.insurance,
            diagnosis: args.diagnosis,
            assignedDoctor: args.assignedDoctor,
            room: args.room,
          });
          addMsg({ role: "action_result", success: true, message: `Paciente ${args.firstName} ${args.lastName} internado.` });
        }
        break;
      }
      case "update_stock_config": {
        const args = data as UpdateStockConfigArgs;
        await rpc.backofficeUpdateStockConfigRpc({
          data: {
            medicationId: args.medicationId,
            warehouseId: args.warehouseId,
            minStock: args.minStock,
            optimalStock: args.optimalStock,
          }
        });
        addMsg({ role: "action_result", success: true, message: `Stock configurado: mínimo ${args.minStock}, óptimo ${args.optimalStock}.` });
        break;
      }
      case "generate_report": {
        const args = data as GenerateReportArgs;
        const store = await import("@/lib/store");
        const state = store.useStore.getState();
        const reportData: ReportData = {
          workspaceName: state.session?.workspaceName ?? "",
          medications: state.medications,
          warehouses: state.warehouses,
          batches: state.batches,
          movements: state.movements,
        };
        let doc: import("jspdf").jsPDF;
        const filename = args.title ?? `reporte-${args.reportType}-${Date.now()}`;
        switch (args.reportType) {
          case "stock":
            doc = generateStockReport(reportData, args.title);
            break;
          case "expiries":
            doc = generateExpiriesReport(reportData, args.title);
            break;
          case "movements":
            doc = generateMovementsReport(reportData, args.periodDays ?? 30, args.title);
            break;
        }
        downloadReport(doc, `${filename}.pdf`);
        addMsg({ role: "action_result", success: true, message: `Reporte "${args.reportType}" descargado.` });
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
    } else if (name === "create_sale") {
      const args = parseCreateSaleArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para venta." });
      } else {
        const label = `Vender ${args.quantity} u. a $${args.price}/u. (total: $${(args.price * args.quantity).toLocaleString("es-AR")})`;
        addMsg({ role: "pending_confirm", label, toolName: "create_sale", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "create_dispensation") {
      const args = parseCreateDispensationArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para dispensación." });
      } else {
        const label = `Dispensar ${args.quantity} u. de medicación a ${args.patient} (Dr. ${args.doctor})`;
        addMsg({ role: "pending_confirm", label, toolName: "create_dispensation", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "create_order") {
      const args = parseCreateOrderArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para pedido." });
      } else {
        const label = `Crear pedido de ${args.quantity} u. para ${args.patient} (${args.room}) — Motivo: ${args.reason}`;
        addMsg({ role: "pending_confirm", label, toolName: "create_order", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "process_order") {
      const args = parseProcessOrderArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para procesar pedido." });
      } else {
        const actionLabel: Record<string, string> = { aprobar: "Aprobar", despachar: "Despachar", confirmar_recepcion: "Confirmar recepción", administrar: "Administrar", rechazar: "Rechazar" };
        const label = `${actionLabel[args.action] ?? args.action} pedido ${args.orderId}`;
        addMsg({ role: "pending_confirm", label, toolName: "process_order", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "advance_transfer") {
      const args = parseAdvanceTransferArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "ID de transferencia inválido." });
      } else {
        const label = `Avanzar transferencia ${args.transferId}`;
        addMsg({ role: "pending_confirm", label, toolName: "advance_transfer", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "reject_transfer") {
      const args = parseRejectTransferArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para rechazar transferencia." });
      } else {
        const label = `Rechazar transferencia ${args.transferId}: ${args.reason} (${args.outcome === "devolver" ? "devolver stock" : "descartar stock"})`;
        addMsg({ role: "pending_confirm", label, toolName: "reject_transfer", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "manage_medication") {
      const args = parseManageMedicationArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para medicamento." });
      } else {
        const label = args.medicationId ? `Actualizar medicamento "${args.name}"` : `Crear medicamento "${args.name}"`;
        addMsg({ role: "pending_confirm", label, toolName: "manage_medication", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "manage_warehouse") {
      const args = parseManageWarehouseArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para depósito." });
      } else {
        const label = args.warehouseId ? `Actualizar depósito "${args.name}"` : `Crear depósito "${args.name}" [${args.type}]`;
        addMsg({ role: "pending_confirm", label, toolName: "manage_warehouse", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "manage_patient") {
      const args = parseManagePatientArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para paciente." });
      } else {
        const label = args.patientId ? `Actualizar paciente ${args.firstName} ${args.lastName}` : `Internar paciente ${args.firstName} ${args.lastName}`;
        addMsg({ role: "pending_confirm", label, toolName: "manage_patient", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "update_stock_config") {
      const args = parseUpdateStockConfigArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Parámetros inválidos para configurar stock." });
      } else {
        const label = `Configurar stock: mínimo ${args.minStock}, óptimo ${args.optimalStock}`;
        addMsg({ role: "pending_confirm", label, toolName: "update_stock_config", data: args });
      }
      lines.push("_(Confirmación pendiente.)_");
    } else if (name === "generate_report") {
      const args = parseGenerateReportArgs(raw);
      if (!args) {
        addMsg({ role: "action_result", success: false, message: "Tipo de reporte inválido." });
      } else {
        const label = `Generar reporte: ${args.reportType}${args.title ? ` — ${args.title}` : ""}`;
        addMsg({ role: "pending_confirm", label, toolName: "generate_report", data: args });
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
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const chartGeneratedRef = useRef(false);

  const proactivityInput = useMemo((): ProactivityInput => ({
    medications: snapshotInput.medications,
    warehouses: snapshotInput.warehouses,
    batches: snapshotInput.batches,
    orders: snapshotInput.orders ?? [],
    transfers: snapshotInput.transfers,
    patients: snapshotInput.patients ?? [],
    stockConfigs: snapshotInput.stockConfigs ?? [],
    stockByMedicationWarehouse: {},
  }), [snapshotInput]);

  const snapshotJson = useMemo(() => buildWorkspaceAssistantContext(snapshotInput), [snapshotInput]);
  const workspaceUsers = useMemo(
    () => storeUsers.filter((u) => u.workspaceId === session?.workspaceId),
    [storeUsers, session?.workspaceId],
  );

  useEffect(() => {
    const top = getTopSuggestions(proactivityInput, 3);
    setSuggestions(top);
  }, [proactivityInput]);

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

    // ─── Workflow: si hay un workflow activo, procesar como respuesta al paso actual ───
    if (activeWorkflow) {
      const wfCtx: WorkflowContext = {
        medications: proactivityInput.medications,
        warehouses: proactivityInput.warehouses,
        patients: proactivityInput.patients.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, room: p.room })),
        batches: proactivityInput.batches,
        orders: proactivityInput.orders,
        transfers: proactivityInput.transfers,
        rooms: (snapshotInput.rooms ?? []).map((r) => ({ id: r.id, fullNumber: r.fullNumber })),
        stockByMedication: {},
      };
      for (const b of proactivityInput.batches) {
        wfCtx.stockByMedication[b.medicationId] = (wfCtx.stockByMedication[b.medicationId] ?? 0) + b.quantity;
      }

      const err = validateWorkflowStep(activeWorkflow, text, wfCtx);
      if (err) {
        setMessages((m) => [...m, { role: "assistant", content: err }]);
        return;
      }

      const result = advanceWorkflow(activeWorkflow, text, wfCtx);
      if ("done" in result) {
        setActiveWorkflow(null);
        setMessages((m) => [...m, { role: "assistant", content: "Procesando..." }]);
        const def = WORKFLOWS[activeWorkflow.workflowId];
        if (def) {
          const execResult = await def.execute(activeWorkflow.collected, wfCtx);
          setMessages((m) => {
            const filtered = m.filter((mm) => !("content" in mm && (mm as { content: string }).content === "Procesando..."));
            return [...filtered, { role: "action_result", success: execResult.success, message: execResult.message }];
          });
          // Refresh suggestions after action
          const freshState = useStore.getState();
          const newInput: ProactivityInput = {
            ...proactivityInput,
            batches: freshState.batches,
            orders: freshState.orders ?? [],
            patients: freshState.patients ?? [],
          };
          setSuggestions(getTopSuggestions(newInput, 3));
        }
      } else {
        setActiveWorkflow(result.wf);
        setMessages((m) => [...m, { role: "assistant", content: result.response }]);
      }
      return;
    }

    // ─── Detectar intents de workflow ───
    if (isSaleIntent(text) && !activeWorkflow) {
      const wf = WORKFLOWS.sale;
      const ctx: WorkflowContext = {
        medications: proactivityInput.medications,
        warehouses: proactivityInput.warehouses,
        patients: proactivityInput.patients.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, room: p.room })),
        batches: proactivityInput.batches,
        orders: proactivityInput.orders,
        transfers: proactivityInput.transfers,
        rooms: (snapshotInput.rooms ?? []).map((r) => ({ id: r.id, fullNumber: r.fullNumber })),
        stockByMedication: {},
      };
      for (const b of proactivityInput.batches) {
        ctx.stockByMedication[b.medicationId] = (ctx.stockByMedication[b.medicationId] ?? 0) + b.quantity;
      }
      const newWf: ActiveWorkflow = { workflowId: "sale", currentStep: 0, collected: {} };
      const prompt = getCurrentStepPrompt(newWf, ctx);
      setActiveWorkflow(newWf);
      setMessages((m) => [...m, { role: "assistant", content: prompt ?? "OK, empecemos. ¿Qué medicamento?" }]);
      return;
    }
    if (isDispensationIntent(text) && !activeWorkflow) {
      const wf = WORKFLOWS.dispensation;
      const ctx: WorkflowContext = {
        medications: proactivityInput.medications,
        warehouses: proactivityInput.warehouses,
        patients: proactivityInput.patients.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, room: p.room })),
        batches: proactivityInput.batches,
        orders: proactivityInput.orders,
        transfers: proactivityInput.transfers,
        rooms: (snapshotInput.rooms ?? []).map((r) => ({ id: r.id, fullNumber: r.fullNumber })),
        stockByMedication: {},
      };
      for (const b of proactivityInput.batches) {
        ctx.stockByMedication[b.medicationId] = (ctx.stockByMedication[b.medicationId] ?? 0) + b.quantity;
      }
      const newWf: ActiveWorkflow = { workflowId: "dispensation", currentStep: 0, collected: {} };
      const prompt = getCurrentStepPrompt(newWf, ctx);
      setActiveWorkflow(newWf);
      setMessages((m) => [...m, { role: "assistant", content: prompt ?? "OK, empecemos. ¿A qué paciente?" }]);
      return;
    }
    if (isOrderIntent(text) && !activeWorkflow) {
      const wf = WORKFLOWS.order;
      const ctx: WorkflowContext = {
        medications: proactivityInput.medications,
        warehouses: proactivityInput.warehouses,
        patients: proactivityInput.patients.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, room: p.room })),
        batches: proactivityInput.batches,
        orders: proactivityInput.orders,
        transfers: proactivityInput.transfers,
        rooms: (snapshotInput.rooms ?? []).map((r) => ({ id: r.id, fullNumber: r.fullNumber })),
        stockByMedication: {},
      };
      for (const b of proactivityInput.batches) {
        ctx.stockByMedication[b.medicationId] = (ctx.stockByMedication[b.medicationId] ?? 0) + b.quantity;
      }
      const newWf: ActiveWorkflow = { workflowId: "order", currentStep: 0, collected: {} };
      const prompt = getCurrentStepPrompt(newWf, ctx);
      setActiveWorkflow(newWf);
      setMessages((m) => [...m, { role: "assistant", content: prompt ?? "OK, empecemos. ¿Qué medicamento se necesita?" }]);
      return;
    }

    // ─── LLM call (existing flow) ───
    setStreaming(true);
    setStreamingText("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const recentMessages = messages.slice(-12);
      const history: ChatMessage[] = [
        { role: "system", content: buildWorkspaceSystemPrompt(snapshotJson, workspaceUsers, snapshotInput) },
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
      const model = aiProvider === "zen" ? "deepseek-v4-flash-free" : "llama3.1:8b";

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

      // Refresh suggestions after response
      const freshState = useStore.getState();
      const newInput: ProactivityInput = {
        ...proactivityInput,
        batches: freshState.batches,
        orders: freshState.orders ?? [],
        patients: freshState.patients ?? [],
      };
      setSuggestions(getTopSuggestions(newInput, 3));
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
  }, [input, streaming, messages, snapshotJson, snapshotInput, navigate, batches, openTransferDialog, addChart, workspaceUsers, activeWorkflow, proactivityInput]);

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
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    [&_table]:border-collapse [&_td]:border [&_th]:border
                    [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1
                    [&_tr]:border [&_hr]:my-2 [&_blockquote]:border-l-2
                    [&_blockquote]:pl-2 [&_blockquote]:opacity-80
                    [&_pre]:bg-black/5 [&_pre]:dark:bg-white/5
                    [&_pre]:rounded [&_pre]:p-2 [&_code]:text-xs"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
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
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingText || ""}
                </ReactMarkdown>
              </div>
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

      {activeWorkflow && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
          <span className="font-medium">Flujo activo: {WORKFLOWS[activeWorkflow.workflowId]?.name}</span>
          {" — "}Paso {activeWorkflow.currentStep + 1} de {WORKFLOWS[activeWorkflow.workflowId]?.steps.length ?? 0}
          <button
            onClick={() => { setActiveWorkflow(null); setMessages((m) => [...m, { role: "assistant", content: "Flujo cancelado." }]); }}
            className="ml-2 underline text-xs"
          >
            Cancelar
          </button>
        </div>
      )}
      {suggestions.length > 0 && !activeWorkflow && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setInput(s.action);
                // Auto-send after brief delay
                setTimeout(() => {
                  const ta = document.querySelector("textarea");
                  if (ta) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
                    nativeInputValueSetter?.call(ta, s.action);
                    ta.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                }, 50);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          placeholder={
            activeWorkflow
              ? "Respondé al asistente para continuar..."
              : "Ej.: ¿Cuántas unidades tenemos de paracetamol? ¿Hay lotes críticos?"
          }
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
        Asistente vía <code className="rounded bg-muted px-0.5">OpenCode Zen</code>{" "}
        (modelo: <span className="font-mono">deepseek-v4-flash-free</span>).
        <span className="ml-2 text-amber-500">Modelos gratuitos</span>
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

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartRenderer } from "@/components/chart-renderer";
import { streamAiChat } from "@/lib/ai-chat";
import { useStore } from "@/lib/store";
import {
  assistantTools,
  parseRenderChartArgs,
  parseOllamaToolArguments,
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
  parseCreateLicitacionArgs,
  parseCreateTransferArgs,
  parseFindSimilarLicitacionesArgs,
  type ChartSpec,
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
  type CreateLicitacionArgs,
  type CreateTransferToolArgs,
  type FindSimilarLicitacionesArgs,
} from "@/lib/assistant-tools";
import type { LossCalculationResult, CrossHospitalMedStock, WarehouseVolumeItem, AssistantFullSnapshot } from "@/lib/server/backoffice-service";

interface DemoAssistantChatProps {
  lossData?: LossCalculationResult | null;
  crossStock?: CrossHospitalMedStock[] | null;
  volumeData?: WarehouseVolumeItem[] | null;
  totalUnits?: number;
  variant?: "floating" | "sidepanel";
}

type Message =
  | { role: "user" | "assistant"; content: string }
  | { role: "chart"; spec: ChartSpec }
  | { role: "action_result"; success: boolean; message: string }
  | { role: "pending_confirm"; label: string; toolName: string; data: unknown };

const PRESET_LOSS_TEXT = "Analizá el sobrestock del Hospital Alemán. Identificá los 3 medicamentos con mayor excedente sobre el nivel óptimo, calculá su valor en $ y cuánto se podría recuperar transfiriendo a Francisco o Blanco. No crees registros en la base de datos. Decime exactamente qué transfers harías, con qué cantidades, y qué tengo que hacer yo para ejecutarlas.";
const PRESET_SAVING_TEXT = "Priorizá las transferencias del análisis anterior por impacto económico. Mostrame el top 5 y el ahorro acumulado. Indicame qué acciones tomar desde cada institución.";
const PRESET_CRITICAL_TEXT = "Analizá qué medicamentos están por debajo del mínimo en cada hospital. Sugerí cuáles cubrir con transfers desde Alemán y cuáles requieren orden de compra urgente.";

function generateLocalResponse(text: string, ctx: DemoAssistantChatProps): string | null {
  const cs = ctx.crossStock;
  if (!cs || cs.length === 0) return null;

  const wsNames = [...new Set(cs.flatMap((m) => m.stocks.map((s) => s.workspaceName)))];
  const alemanName = wsNames.find((n) => n.includes("Alemán")) ?? "";
  const franciscoName = wsNames.find((n) => n.includes("Francisco")) ?? "";
  const blancoName = wsNames.find((n) => n.includes("Blanco")) ?? "";
  if (!alemanName || !franciscoName || !blancoName) return null;

  if (text === PRESET_LOSS_TEXT) {
    type MedExcess = { name: string; excess: number; price: number; deficitHospital: string; deficitQty: number };
    const overstock: MedExcess[] = [];
    for (const m of cs) {
      const alemanStock = m.stocks.find((s) => s.workspaceName === alemanName);
      if (!alemanStock || alemanStock.quantity <= alemanStock.optimalStock) continue;
      const excess = alemanStock.quantity - alemanStock.optimalStock;
      const deficitHospital = m.stocks.find((s) => s.workspaceName !== alemanName && s.quantity < s.minStock);
      const deficitQty = deficitHospital ? Math.min(excess, deficitHospital.minStock - deficitHospital.quantity) : excess;
      overstock.push({
        name: m.medicationName,
        excess,
        price: m.salePrice,
        deficitHospital: deficitHospital?.workspaceName ?? franciscoName,
        deficitQty,
      });
    }
    overstock.sort((a, b) => b.excess - a.excess);
    const top3 = overstock.slice(0, 3);
    if (top3.length === 0) return "No se detectó sobrestock significativo en el Hospital Alemán. Todos los medicamentos están dentro del nivel óptimo.";

    const totalExcess = top3.reduce((s, m) => s + m.excess, 0);
    const totalValue = top3.reduce((s, m) => s + m.excess * m.price, 0);
    const lines = top3.map((m) => {
      const val = m.excess * m.price;
      return `**${m.name}**: ${m.excess} u. excedentes ($${val.toLocaleString("es-AR")}) → transferir ${m.deficitQty} u. a **${m.deficitHospital}**`;
    });
    return `**Sobrestock en Hospital Alemán — Top 3**

${lines.join("\n")}

**Resumen**: ${totalExcess} u. excedentes por un valor de $${totalValue.toLocaleString("es-AR")}.

**Nota**: como Alemán y ${top3[0]?.deficitHospital ?? franciscoName} son hospitales distintos, no puedo crear las transferencias automáticamente. Un administrador debe ejecutarlas desde el módulo _Transferencias Internas_. Te paso los detalles exactos para que las gestiones.`;
  }

  if (text === PRESET_SAVING_TEXT) {
    const ld = ctx.lossData;
    if (!ld || ld.byMedication.length === 0) return null;
    const sorted = [...ld.byMedication].sort((a, b) => b.potentialSaving - a.potentialSaving);
    const top5 = sorted.slice(0, 5);
    const totalSaving = top5.reduce((s, m) => s + m.potentialSaving, 0);
    const lines = top5.map((m, i) =>
      `${i + 1}. **${m.medicationName}**: excedente ${m.surplusQuantity} u. en ${m.surplusHospital}, déficit ${m.deficitQuantity} u. en ${m.deficitHospital}. Ahorro: $${m.potentialSaving.toLocaleString("es-AR")}`
    );
    return `**Top 5 transferencias por impacto económico**

${lines.join("\n")}

**Ahorro acumulado**: $${totalSaving.toLocaleString("es-AR")}.
**Ahorro total posible**: $${ld.totalSavingWithTransfers.toLocaleString("es-AR")}.

**Nota**: como los hospitales son distintos, no puedo crear estas transferencias automáticamente. Un administrador debe ejecutarlas desde el módulo _Transferencias Internas_. Los detalles están arriba para que las gestiones.`;
  }

  if (text === PRESET_CRITICAL_TEXT) {
    const transferSuggestions: string[] = [];
    const purchaseSuggestions: string[] = [];

    for (const m of cs) {
      for (const s of m.stocks) {
        if (s.quantity >= s.minStock) continue;
        const deficit = s.minStock - s.quantity;
        const origin = cs.find((x) => x.medicationName === m.medicationName)?.stocks.find((y) => y.workspaceName === alemanName);
        if (origin && origin.quantity > origin.optimalStock) {
          const available = origin.quantity - origin.optimalStock;
          const transfer = Math.min(deficit, available);
          if (transfer > 0) {
            transferSuggestions.push(`- **${m.medicationName}** en ${s.workspaceName}: transferir ${transfer} u. desde ${alemanName} (disponible: ${available} u.)`);
          }
        }
        if (deficit > 0) {
          purchaseSuggestions.push(`- **${m.medicationName}** en ${s.workspaceName}: faltan ${deficit} u. — solicitar orden de compra urgente`);
        }
      }
    }

    const lines: string[] = [];
    if (transferSuggestions.length > 0) {
      lines.push("**Cubrir con transfers desde Alemán:**", ...transferSuggestions);
    }
    if (purchaseSuggestions.length > 0) {
      lines.push("**Requieren orden de compra:**", ...purchaseSuggestions);
    }
    if (lines.length === 0) {
      return "No se detectaron medicamentos por debajo del mínimo en ningún hospital.";
    }
    const isCrossHospital = transferSuggestions.some((s) => s.includes(alemanName));
    if (isCrossHospital) {
      lines.push("", "**Nota**: las transferencias sugeridas son entre hospitales distintos y no pueden ejecutarse automáticamente. Un administrador debe crearlas desde el módulo _Transferencias Internas_.");
    }
    return lines.join("\n");
  }

  return null;
}

function buildSystemPrompt(snapshot: AssistantFullSnapshot | null, ctx: DemoAssistantChatProps): string {
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

### /backoffice/estado-hospital — Estado Multi-Hospital (solo backoffice)
Dashboard global con stock cruzado entre los 3 hospitales, calculadora de pérdidas y gráficos.

### /backoffice/compras — Optimización de Compras (solo backoffice)
Módulo de licitación inteligente: compara escenario "sin transfers" vs "con transfers", genera PDF.
`;

  const stockStr = ctx.totalUnits
    ? `Stock total del sistema: ${ctx.totalUnits.toLocaleString("es-AR")} unidades en 3 hospitales.\n`
    : "";

  const lossStr = ctx.lossData
    ? `Pérdida total sin transfers: $${ctx.lossData.totalLossWithoutTransfers.toLocaleString("es-AR")}. Ahorro posible: $${ctx.lossData.totalSavingWithTransfers.toLocaleString("es-AR")}.`
    : "";

  const crossStockStr = ctx.crossStock && ctx.crossStock.length > 0
    ? `
## Stock actual por medicamento (top 15 por stock total)
${ctx.crossStock
  .map((m) => ({ ...m, totalStock: m.stocks.reduce((s, ws) => s + ws.quantity, 0) }))
  .sort((a, b) => b.totalStock - a.totalStock)
  .slice(0, 15)
  .map((m) => {
    const lines = m.stocks.map((s) => `    ${s.workspaceName}: ${s.quantity} u. (min: ${s.minStock}, óptimo: ${s.optimalStock})`);
    return `- **${m.medicationName}** (precio: $${m.salePrice}/u.)
${lines.join("\n")}`;
  }).join("\n")}`
    : "";

  const lossDetailStr = ctx.lossData && ctx.lossData.byMedication.length > 0
    ? `
## Pérdida por medicamento (top 10 por pérdida)
${ctx.lossData.byMedication
  .sort((a, b) => b.currentLoss - a.currentLoss)
  .slice(0, 10)
  .map((m) =>
  `- **${m.medicationName}**: excedente ${m.surplusQuantity} u. en ${m.surplusHospital} → déficit ${m.deficitQuantity} u. en ${m.deficitHospital}. Pérdida actual: $${m.currentLoss.toLocaleString("es-AR")}. Ahorro potencial: $${m.potentialSaving.toLocaleString("es-AR")}.`
).join("\n")}`
    : "";

  const snapshotText = snapshot
    ? `
## Datos del sistema (IDs para acciones)

### Hospitales / Workspaces
${snapshot.workspaces.map((w) => `- ${w.name} (id: ${w.id}, slug: ${w.slug})`).join("\n")}

### Medicamentos
${snapshot.medications.map((m) => `- ${m.name} en ${m.workspaceName} (id: ${m.id})`).join("\n")}

### Depósitos
${snapshot.warehouses.map((w) => `- ${w.name} [${w.type}] en ${w.workspaceName} (id: ${w.id})`).join("\n")}

### Usuarios
${snapshot.users.map((u) => `- ${u.name} <${u.email}> rol:${u.role} en ${u.workspaceName} (id: ${u.id})`).join("\n")}

Total unidades en sistema: ${snapshot.totalUnits.toLocaleString("es-AR")}
`
    : "";

  return `Sos Medi, el asistente virtual de Meditory — sistema de gestión de stock hospitalario.

Podés responder preguntas, mostrar datos del sistema, navegar a pantallas, y ejecutar acciones como agregar stock o gestionar usuarios.

${MODULE_KNOWLEDGE}

${stockStr}${lossStr}${crossStockStr}${lossDetailStr}

${snapshotText}

### Reglas
- Usar tools SOLO cuando el usuario pida explícitamente la acción (navegar, agregar stock, crear usuario, crear transferencia).
- Para preguntas informativas, responder en texto usando los datos del snapshot.
- Para acciones destructivas (eliminar usuario), mostrar los datos y pedir confirmación antes de ejecutar.
- Si no tenés los IDs necesarios, preguntar primero.
- Responder siempre en español, tono profesional pero amigable.
- No inventar datos. Si no están en el snapshot, decirlo.
- Para agregar stock: usar SIEMPRE la tool add_stock con los IDs reales del snapshot. Si el usuario menciona un medicamento por nombre, buscar su ID en la lista de medicamentos. Si hay múltiples hospitales, preguntar cuál corresponde y luego llamar la tool. No responder en texto sobre acciones que deberías ejecutar — ejecutalas con la tool.
- Para transferencias de stock: si ves sobrestock en un depósito y déficit en otro, podés crear la transferencia usando la tool create_transfer cuando el usuario lo solicite, con los IDs reales del snapshot (medicationId, sourceBatchId, fromWarehouseId, toWarehouseId, quantity). Funciona tanto para transferencias dentro del mismo hospital como entre hospitales distintos.`;
}

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
  addMsg: (m: Message) => void,
  setFullSnapshot: (s: AssistantFullSnapshot | null) => void,
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
        rpc.backofficeGetAssistantFullSnapshotRpc().then(setFullSnapshot).catch(console.error);
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
        rpc.backofficeGetAssistantFullSnapshotRpc().then(setFullSnapshot).catch(console.error);
        break;
      }
      case "delete_user": {
        const args = data as DeleteUserArgs;
        await rpc.backofficeDeleteUserRpc({ data: { id: args.userId } });
        addMsg({ role: "action_result", success: true, message: "Usuario eliminado correctamente." });
        rpc.backofficeGetAssistantFullSnapshotRpc().then(setFullSnapshot).catch(console.error);
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
        const { generateStockReport, generateExpiriesReport, generateMovementsReport, downloadReport } = await import("@/lib/assistant-reports");
        const reportData = {
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
      case "create_licitacion": {
        const args = data as CreateLicitacionArgs;
        await rpc.licitacionesCreateRpc({ data: args });
        addMsg({ role: "action_result", success: true, message: `Licitación ${args.codigo} creada: "${args.titulo}" con ${args.items.length} items.` });
        rpc.backofficeGetAssistantFullSnapshotRpc().then(setFullSnapshot).catch(console.error);
        break;
      }
      case "create_transfer": {
        const args = data as CreateTransferToolArgs;
        await rpc.backofficeCreateTransferRpc({
          data: {
            medicationId: args.medicationId,
            sourceBatchId: args.sourceBatchId,
            fromWarehouseId: args.fromWarehouseId,
            toWarehouseId: args.toWarehouseId,
            quantity: args.quantity,
          },
        });
        addMsg({ role: "action_result", success: true, message: `Transferencia creada: ${args.quantity} u. de ${args.medicationId.slice(0,8)} → destino.` });
        rpc.backofficeGetAssistantFullSnapshotRpc().then(setFullSnapshot).catch(console.error);
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

export const CHAT_PRESET_EVENT = "chat-preset";

const WELCOME_MSG: Message = { role: "assistant", content: "Hola, soy **Medi**, el asistente del sistema Meditory. Preguntame sobre stock, pérdidas, compras o lo que necesites." };

export function DemoAssistantChat({ variant = "floating", ...props }: DemoAssistantChatProps) {
  const [open, setOpen] = useState(variant === "sidepanel");
  const storedMessages = useStore((s) => s.chatMessages);
  const setStoredMessages = useStore((s) => s.setChatMessages);
  const [messages, setMessages] = useState<Message[]>(() =>
    storedMessages.length > 0 ? storedMessages as Message[] : [WELCOME_MSG],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [internalData, setInternalData] = useState<DemoAssistantChatProps | null>(null);
  const [fullSnapshot, setFullSnapshot] = useState<AssistantFullSnapshot | null>(null);

  const ctx = internalData ?? props;

  // Ref para saber si los datos están cargados (útil en preset event listener)
  const dataReadyRef = useRef(false);
  dataReadyRef.current = !!internalData;

  // Auto-scroll al abrir o al recibir mensajes (solo dentro del contenedor)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, messages, streamingText]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // === Presets: responder desde datos locales sin llamar al LLM ===
    const PRESET_LOSS_TEXT = "Analizá el sobrestock del Hospital Alemán. Identificá los 3 medicamentos con mayor excedente sobre el nivel óptimo, calculá su valor en $ y cuánto se podría recuperar transfiriendo a Francisco o Blanco. No crees registros en la base de datos. Decime exactamente qué transfers harías, con qué cantidades, y qué tengo que hacer yo para ejecutarlas.";
    const PRESET_SAVING_TEXT = "Priorizá las transferencias del análisis anterior por impacto económico. Mostrame el top 5 y el ahorro acumulado. Indicame qué acciones tomar desde cada institución.";
    const PRESET_CRITICAL_TEXT = "Analizá qué medicamentos están por debajo del mínimo en cada hospital. Sugerí cuáles cubrir con transfers desde Alemán y cuáles requieren orden de compra urgente.";

    const localResponse = generateLocalResponse(text, ctx);

    if (localResponse) {
      setStreamingText(localResponse);
      await new Promise((r) => setTimeout(r, 50));
      setMessages([...updatedMessages, { role: "assistant", content: localResponse }]);
      setStreaming(false);
      setStreamingText("");
      return;
    }

    // Fallback a LLM
    setStreaming(true);
    setStreamingText("");

    try {
      await streamWithLoop(updatedMessages, 0);
    } catch {
      setMessages([...updatedMessages, { role: "assistant", content: "No pude conectarme ahora. ¡Intentá de nuevo!" }]);
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  }, [messages, streaming, ctx, fullSnapshot]);

  async function streamWithLoop(
    history: Message[],
    depth: number,
  ) {
    if (depth > 3) {
      if (!history.some((m) => m.role === "assistant" && m.content.startsWith("No pude completar"))) {
        setMessages([...history, { role: "assistant", content: "No pude completar la operación." }]);
      }
      return;
    }

    const chatMessages = [
      { role: "system" as const, content: buildSystemPrompt(fullSnapshot, ctx) },
      ...history.slice(-8).flatMap((m): { role: "user" | "assistant"; content: string }[] =>
        m.role === "chart" || m.role === "pending_confirm" || m.role === "action_result"
          ? []
          : [{ role: m.role as "user" | "assistant", content: m.content }],
      ),
    ];

    abortRef.current = new AbortController();
    const aiProvider = useStore.getState().aiProvider;
    const model = "deepseek-v4-flash-free";

    console.debug("[chat] prompt chars:", chatMessages.reduce((s, m) => s + m.content.length, 0));
    let fullText = "";
    const collectedToolCalls: OllamaToolCall[] = [];

    try {
      for await (const event of streamAiChat({
        model,
        messages: chatMessages,
        tools: assistantTools,
        signal: abortRef.current.signal,
        provider: aiProvider,
      })) {
        console.debug("[chat] event type:", event.type, event.type === "done" ? "content_len:" + event.content.length + " tools:" + event.tool_calls.length : "");
        if (event.type === "text") {
          fullText += event.content;
          setStreamingText(fullText);
        } else if (event.type === "tool_calls") {
          for (const tc of event.tool_calls) {
            const existing = collectedToolCalls.find(
              (e) => (e.function?.name ?? "") === (tc.function?.name ?? ""),
            );
            if (existing) {
              if (typeof tc.function?.arguments === "string" && typeof existing.function?.arguments === "string") {
                existing.function.arguments += tc.function.arguments;
              }
            } else {
              collectedToolCalls.push(tc);
            }
          }
        } else if (event.type === "done") {
          fullText = event.content || fullText;
          break;
        } else if (event.type === "error") {
          fullText = `Ups, tuve un problema conectándome: ${event.message}`;
          break;
        }
      }
    } catch {
      setMessages([...history, { role: "assistant", content: "No pude conectarme ahora. ¡Intentá de nuevo!" }]);
      return;
    }

    const nextMessages: Message[] = [...history];
    const inlineResults: { role: "assistant" | "action_result"; content: string; success?: boolean }[] = [];
    let hasInlineTool = false;
    let showMatchesAndStop = false;

    for (const tc of collectedToolCalls) {
      const name = tc.function?.name ?? "";
      const parsedArgs = parseOllamaToolArguments(tc);
      if (name === "render_chart") {
        const args = parseRenderChartArgs(parsedArgs);
        if (args) {
          nextMessages.push({ role: "chart", spec: args });
        }
        hasInlineTool = true;
      } else if (name === "add_stock") {
        const args = parseAddStockArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para agregar stock." });
        } else {
          const med = fullSnapshot?.medications.find((m) => m.id === args.medicationId);
          const wh = fullSnapshot?.warehouses.find((w) => w.id === args.warehouseId);
          const label = `Agregar ${args.quantity} u. de "${med?.name ?? args.medicationId}" al depósito "${wh?.name ?? args.warehouseId}" (${wh?.workspaceName ?? ""})${args.registerAsPurchase ? " — registrar como compra" : ""}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "add_stock", data: args });
        }
      } else if (name === "list_users") {
        const args = parseListUsersArgs(parsedArgs);
        const users = fullSnapshot?.users ?? [];
        const filtered = args.workspaceId
          ? users.filter((u) => u.workspaceId === args.workspaceId)
          : users;
        const text = filtered.length === 0
          ? "No se encontraron usuarios."
          : filtered.map((u) => `• **${u.name}** — ${u.email} | rol: ${u.role} | ${u.workspaceName}`).join("\n");
        inlineResults.push({ role: "assistant", content: text });
        hasInlineTool = true;
      } else if (name === "create_user") {
        const args = parseCreateUserArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para crear usuario." });
        } else {
          const ws = fullSnapshot?.workspaces.find((w) => w.id === args.workspaceId);
          const label = `Crear usuario "${args.name}" <${args.email}> con rol "${args.role}" en ${ws?.name ?? args.workspaceId}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_user", data: args });
        }
      } else if (name === "delete_user") {
        const args = parseDeleteUserArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "ID de usuario inválido." });
        } else {
          const user = fullSnapshot?.users.find((u) => u.id === args.userId);
          const label = `Eliminar usuario "${user?.name ?? args.userId}" <${user?.email ?? ""}> de ${user?.workspaceName ?? ""}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "delete_user", data: args });
        }
      } else if (name === "create_sale") {
        const args = parseCreateSaleArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para venta." });
        } else {
          const label = `Vender ${args.quantity} u. a $${args.price}/u. (total: $${(args.price * args.quantity).toLocaleString("es-AR")})`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_sale", data: args });
        }
      } else if (name === "create_dispensation") {
        const args = parseCreateDispensationArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para dispensación." });
        } else {
          const label = `Dispensar ${args.quantity} u. de medicación a ${args.patient} (Dr. ${args.doctor})`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_dispensation", data: args });
        }
      } else if (name === "create_order") {
        const args = parseCreateOrderArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para pedido." });
        } else {
          const label = `Crear pedido de ${args.quantity} u. para ${args.patient} (${args.room})`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_order", data: args });
        }
      } else if (name === "process_order") {
        const args = parseProcessOrderArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para procesar pedido." });
        } else {
          const actionLabel: Record<string, string> = { aprobar: "Aprobar", despachar: "Despachar", confirmar_recepcion: "Confirmar recepción", administrar: "Administrar", rechazar: "Rechazar" };
          const label = `${actionLabel[args.action] ?? args.action} pedido ${args.orderId}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "process_order", data: args });
        }
      } else if (name === "advance_transfer") {
        const args = parseAdvanceTransferArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "ID de transferencia inválido." });
        } else {
          const label = `Avanzar transferencia ${args.transferId}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "advance_transfer", data: args });
        }
      } else if (name === "reject_transfer") {
        const args = parseRejectTransferArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para rechazar transferencia." });
        } else {
          const label = `Rechazar transferencia ${args.transferId}: ${args.reason}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "reject_transfer", data: args });
        }
      } else if (name === "manage_medication") {
        const args = parseManageMedicationArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para medicamento." });
        } else {
          const label = args.medicationId ? `Actualizar medicamento "${args.name}"` : `Crear medicamento "${args.name}"`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "manage_medication", data: args });
        }
      } else if (name === "manage_warehouse") {
        const args = parseManageWarehouseArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para depósito." });
        } else {
          const label = args.warehouseId ? `Actualizar depósito "${args.name}"` : `Crear depósito "${args.name}" [${args.type}]`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "manage_warehouse", data: args });
        }
      } else if (name === "manage_patient") {
        const args = parseManagePatientArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para paciente." });
        } else {
          const label = args.patientId ? `Actualizar paciente ${args.firstName} ${args.lastName}` : `Internar paciente ${args.firstName} ${args.lastName}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "manage_patient", data: args });
        }
      } else if (name === "update_stock_config") {
        const args = parseUpdateStockConfigArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para configurar stock." });
        } else {
          const label = `Configurar stock: mínimo ${args.minStock}, óptimo ${args.optimalStock}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "update_stock_config", data: args });
        }
      } else if (name === "generate_report") {
        const args = parseGenerateReportArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Tipo de reporte inválido." });
        } else {
          const label = `Generar reporte: ${args.reportType}${args.title ? ` — ${args.title}` : ""}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "generate_report", data: args });
        }
      } else if (name === "create_licitacion") {
        const args = parseCreateLicitacionArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para crear licitación." });
        } else {
          const label = `Crear licitación ${args.codigo}: ${args.titulo} (${args.items.length} items)`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_licitacion", data: args });
        }
      } else if (name === "create_transfer") {
        const args = parseCreateTransferArgs(parsedArgs);
        if (!args) {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos para crear transferencia." });
        } else {
          const label = `Transferir ${args.quantity} u. de ${args.medicationId.slice(0, 8)}: ${args.fromWarehouseId.slice(0, 8)} → ${args.toWarehouseId.slice(0, 8)}`;
          nextMessages.push({ role: "pending_confirm", label, toolName: "create_transfer", data: args });
        }
      } else if (name === "find_similar_licitaciones") {
        const args = parseFindSimilarLicitacionesArgs(parsedArgs);
        if (args) {
          try {
            const rpc = await import("@/lib/server-rpc");
            const result = await rpc.licitacionesFindSimilarRpc({ data: { medicationIds: args.medicationIds } });
            const sims = result as { licitacion: { codigo: string; titulo: string; estado: string }; matchCount: number; matchedMedicationIds: string[] }[];
            if (sims.length > 0) {
              const lines = sims.map((s) => `- ${s.licitacion.codigo}: ${s.licitacion.titulo} (${s.licitacion.estado}, ${s.matchCount} medicamento(s) en común)`);
              nextMessages.push({ role: "action_result", success: true, message: `🔍 Se encontraron licitaciones activas que incluyen esos medicamentos:\n${lines.join("\n")}\n\nRevisalas antes de crear una nueva.` });
              showMatchesAndStop = true;
            } else {
              inlineResults.push({ role: "action_result", success: true, content: "✅ No se encontraron licitaciones activas similares. Podés proceder a crear una nueva." });
              hasInlineTool = true;
            }
          } catch {
            inlineResults.push({ role: "action_result", success: false, content: "Error al buscar licitaciones similares." });
            hasInlineTool = true;
          }
        } else {
          inlineResults.push({ role: "action_result", success: false, content: "Parámetros inválidos." });
          hasInlineTool = true;
        }
      }
    }

    // Si hay tool calls que requieren confirmación (pending_confirm), agregamos el texto original del LLM
    // Si hay inline tools, alimentamos el resultado al LLM para una segunda vuelta
    // Si no hay tool calls, mostramos el texto del LLM

    if (showMatchesAndStop) {
      setMessages(nextMessages);
      return;
    }

    const hasPendingConfirm = collectedToolCalls.some((tc) => {
      const name = tc.function?.name ?? "";
      return !["render_chart", "list_users", "find_similar_licitaciones"].includes(name);
    });

    if (hasInlineTool && !hasPendingConfirm) {
      // Solo inline tools: mostrar el texto del LLM antes del resultado
      if (fullText.trim()) {
        nextMessages.push({ role: "assistant", content: fullText });
      }
      for (const r of inlineResults) {
        if (r.role === "action_result") {
          nextMessages.push({ role: "action_result", success: r.success ?? false, message: r.content });
        } else {
          nextMessages.push({ role: "assistant", content: r.content });
        }
      }
      setMessages(nextMessages);
      await streamWithLoop(nextMessages, depth + 1);
    } else if (hasPendingConfirm) {
      // Pending confirm: show LLM text + confirm buttons
      if (fullText.trim()) {
        nextMessages.push({ role: "assistant", content: fullText });
      }
      for (const r of inlineResults) {
        if (r.role === "action_result") {
          nextMessages.push({ role: "action_result", success: r.success ?? false, message: r.content });
        } else {
          nextMessages.push({ role: "assistant", content: r.content });
        }
      }
      setMessages(nextMessages);
    } else if (collectedToolCalls.length > 0) {
      // Solo render_chart: show LLM text + chart
      if (fullText.trim()) {
        nextMessages.push({ role: "assistant", content: fullText });
      }
      for (const r of inlineResults) {
        if (r.role === "action_result") {
          nextMessages.push({ role: "action_result", success: r.success ?? false, message: r.content });
        } else {
          nextMessages.push({ role: "assistant", content: r.content });
        }
      }
      setMessages(nextMessages);
    } else if (fullText.trim()) {
      nextMessages.push({ role: "assistant", content: fullText });
      setMessages(nextMessages);
    } else {
      nextMessages.push({ role: "assistant", content: "No obtuve respuesta del asistente. Probá de nuevo o reformulá la consulta." });
      setMessages(nextMessages);
    }
  }

  // Ref for preset event (avoids stale closure)
  const sendMessageRef = useRef<(text: string) => void>(sendMessage);
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    function onPreset(e: CustomEvent<string>) {
      const text = e.detail;
      if (!text) return;
      setOpen(true);
      const trySend = () => {
        if (dataReadyRef.current) {
          setTimeout(() => sendMessageRef.current(text), 50);
        } else {
          setTimeout(trySend, 200);
        }
      };
      setTimeout(trySend, 300);
    }
    window.addEventListener(CHAT_PRESET_EVENT, onPreset as EventListener);
    return () => window.removeEventListener(CHAT_PRESET_EVENT, onPreset as EventListener);
  }, []);

  // Auto-cargar datos si no vienen por props
  useEffect(() => {
    if (props.lossData && props.crossStock && props.totalUnits !== undefined) {
      setInternalData(props);
      return;
    }
    if (internalData) return;
    import("@/lib/server-rpc").then(async (rpc) => {
      const [lossData, crossStock, volumeData, dashboardData] = await Promise.all([
        rpc.backofficeGetLossCalculationRpc(),
        rpc.backofficeGetCrossHospitalStockRpc(),
        rpc.backofficeGetWarehouseVolumeDataRpc(),
        rpc.backofficeGetDashboardDataRpc(),
      ]);
      const workspaces = (dashboardData as { workspaces?: { totalUnits: number }[] })?.workspaces ?? [];
      const totalUnits = workspaces.reduce((s, ws) => s + ws.totalUnits, 0);
      setInternalData({
        lossData: lossData as LossCalculationResult,
        crossStock: crossStock as CrossHospitalMedStock[],
        volumeData: volumeData as WarehouseVolumeItem[],
        totalUnits,
      });
    }).catch(() => {});
    import("@/lib/server-rpc").then(async (rpc) => {
      try {
        const snapshot = await rpc.backofficeGetAssistantFullSnapshotRpc();
        setFullSnapshot(snapshot as unknown as AssistantFullSnapshot);
      } catch (e) {
        console.error("Error loading assistant snapshot", e);
      }
    });
  }, [props, internalData]);

  // Persistir mensajes de texto al store
  useEffect(() => {
    const textMessages = messages
      .filter((m) => m.role !== "chart" && m.role !== "action_result" && m.role !== "pending_confirm")
      .filter((m): m is { role: "user" | "assistant"; content: string } => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    setStoredMessages(textMessages);
  }, [messages, setStoredMessages]);

  const chatPanel = (
    <div
      className={`flex flex-col overflow-hidden bg-card border rounded-xl ${variant === "sidepanel" ? "h-full" : ""}`}
      style={variant === "floating" ? { maxHeight: "min(75dvh, 700px)" } : { height: "100%" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-primary text-primary-foreground shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <Bot size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Medi</p>
          <p className="text-[10px] opacity-70">Asistente Meditory</p>
        </div>
        {variant === "floating" && (
          <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
            <Minimize2 size={16} />
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => {
          if (msg.role === "chart") {
            return (
              <div key={i} className="w-full">
                <ChartRenderer spec={msg.spec} height={300} />
              </div>
            );
          }
          if (msg.role === "action_result") {
            return (
              <div key={i} className={`rounded-lg p-3 text-sm ${msg.success ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300" : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"}`}>
                {msg.success ? "✓ " : "✗ "}{msg.message}
              </div>
            );
          }
          if (msg.role === "pending_confirm") {
            return (
              <PendingConfirmBubble
                key={i}
                msg={msg}
                onConfirm={() => {
                  executeConfirmedAction(msg.toolName, msg.data, (m) => {
                    setMessages((prev) => [...prev, m]);
                  }, setFullSnapshot);
                  setMessages((prev) => prev.filter((_, idx) => idx !== i));
                }}
                onCancel={() => {
                  setMessages((prev) => prev.filter((_, idx) => idx !== i));
                  setMessages((prev) => [...prev, { role: "assistant", content: "Acción cancelada." }]);
                }}
              />
            );
          }
          return (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-0.5 shrink-0">
                <Bot size={12} className="text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              }`}
            >
              {msg.role === "user"
                  ? msg.content
                   : <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1 [&_tr]:border [&_hr]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_pre]:bg-black/5 [&_pre]:dark:bg-white/5 [&_pre]:rounded [&_pre]:p-2 [&_code]:text-xs"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>}
            </div>
          </div>
        );
        })}
        {streaming && streamingText && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-1.5 mt-0.5 shrink-0">
              <Bot size={12} className="text-primary" />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm bg-muted leading-relaxed">
              {streamingText}
              <span className="inline-block w-1 h-3 ml-0.5 bg-primary animate-pulse rounded" />
            </div>
          </div>
        )}
        {streaming && !streamingText && (
          <div className="flex justify-start items-center gap-1 ml-8">
            {[0, 0.15, 0.3].map((delay, i) => (
              <motion.div key={i} className="w-2 h-2 rounded-full bg-muted-foreground/40"
                animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (() => { const t = input.trim(); if (t) { setInput(""); sendMessage(t); } })()}
          placeholder="Preguntame algo..."
          className="text-sm h-9"
          disabled={streaming}
        />
        <Button size="sm" onClick={() => { const t = input.trim(); if (t) { setInput(""); sendMessage(t); } }} disabled={!input.trim() || streaming} className="h-9 w-9 p-0 shrink-0">
          <Send size={14} />
        </Button>
      </div>
    </div>
  );

  if (variant === "sidepanel") {
    return chatPanel;
  }

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-2xl"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ boxShadow: open ? "0 0 0 4px hsl(var(--primary) / 0.3)" : "0 4px 20px rgba(0,0,0,0.3)" }}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={22} /></motion.div>
            : <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Bot size={22} /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-80 sm:w-[520px] lg:w-[640px]"
          >
            {chatPanel}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

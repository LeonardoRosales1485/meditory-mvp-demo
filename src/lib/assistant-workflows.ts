export type WorkflowStepDef = {
  field: string;
  prompt: string;
  validate: (value: string, ctx: WorkflowContext) => string | null;
  options?: { label: string; value: string }[];
};

export type WorkflowContext = {
  medications: { id: string; name: string }[];
  warehouses: { id: string; name: string; type: string }[];
  patients: { id: string; firstName: string; lastName: string; room: string }[];
  batches: { id: string; medicationId: string; warehouseId: string; quantity: number }[];
  orders: { id: string; medicationId: string; status: string }[];
  transfers: { id: string; medicationId: string; status: string }[];
  rooms: { id: string; fullNumber: number }[];
  stockByMedication: Record<string, number>;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStepDef[];
  execute: (collected: Record<string, string>, ctx: WorkflowContext) => Promise<{ success: boolean; message: string }>;
  onComplete: string;
};

export type ActiveWorkflow = {
  workflowId: string;
  currentStep: number;
  collected: Record<string, string>;
};

const SALE_STEPS: WorkflowStepDef[] = [
  {
    field: "medicationId",
    prompt: "¿Qué medicamento querés vender?",
    validate: (v, ctx) => {
      const found = ctx.medications.find((m) => m.id === v || m.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese medicamento. Revisá el catálogo.";
      return null;
    },
    options: [],
  },
  {
    field: "warehouseId",
    prompt: "¿Desde qué depósito se vende?",
    validate: (v, ctx) => {
      const found = ctx.warehouses.find((w) => w.id === v || w.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese depósito.";
      return null;
    },
    options: [],
  },
  {
    field: "quantity",
    prompt: "¿Cuántas unidades?",
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "Ingresá un número positivo.";
      return null;
    },
  },
  {
    field: "price",
    prompt: "¿Cuál es el precio unitario?",
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "Ingresá un precio válido.";
      return null;
    },
  },
  {
    field: "prescription",
    prompt: "¿Tiene receta? Si sí, ingresá el número. Si no, decí «no».",
    validate: () => null,
  },
];

const DISPENSATION_STEPS: WorkflowStepDef[] = [
  {
    field: "patientId",
    prompt: "¿A qué paciente se la dispensamos?",
    validate: (v, ctx) => {
      const found = ctx.patients.find((p) => p.id === v || `${p.firstName} ${p.lastName}`.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese paciente.";
      return null;
    },
    options: [],
  },
  {
    field: "medicationId",
    prompt: "¿Qué medicamento?",
    validate: (v, ctx) => {
      const found = ctx.medications.find((m) => m.id === v || m.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese medicamento.";
      return null;
    },
    options: [],
  },
  {
    field: "warehouseId",
    prompt: "¿Desde qué depósito?",
    validate: (v, ctx) => {
      const found = ctx.warehouses.find((w) => w.id === v || w.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese depósito.";
      return null;
    },
    options: [],
  },
  {
    field: "quantity",
    prompt: "¿Cuántas unidades?",
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "Ingresá un número positivo.";
      return null;
    },
  },
  {
    field: "doctor",
    prompt: "¿Quién es el médico que prescribe?",
    validate: (v) => v.length < 2 ? "Ingresá un nombre válido." : null,
  },
  {
    field: "treatment",
    prompt: "¿Cuál es la indicación o tratamiento?",
    validate: (v) => v.length < 2 ? "Ingresá una indicación válida." : null,
  },
];

const ORDER_STEPS: WorkflowStepDef[] = [
  {
    field: "medicationId",
    prompt: "¿Qué medicamento se necesita?",
    validate: (v, ctx) => {
      const found = ctx.medications.find((m) => m.id === v || m.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese medicamento.";
      return null;
    },
    options: [],
  },
  {
    field: "warehouseId",
    prompt: "¿En qué depósito se entrega?",
    validate: (v, ctx) => {
      const found = ctx.warehouses.find((w) => w.id === v || w.name.toLowerCase().includes(v.toLowerCase()));
      if (!found) return "No encontré ese depósito.";
      return null;
    },
    options: [],
  },
  {
    field: "quantity",
    prompt: "¿Cuántas unidades?",
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "Ingresá un número positivo.";
      return null;
    },
  },
  {
    field: "patient",
    prompt: "¿Paciente o sala?",
    validate: (v) => v.length < 2 ? "Ingresá un nombre válido." : null,
  },
  {
    field: "room",
    prompt: "¿Sala/habitación?",
    validate: (v) => v.length < 1 ? "Ingresá una sala válida." : null,
  },
  {
    field: "reason",
    prompt: "¿Motivo del pedido?",
    validate: (v) => v.length < 3 ? "Describí el motivo brevemente." : null,
  },
];

export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  sale: {
    id: "sale",
    name: "Venta",
    description: "Registrar una venta al público",
    steps: SALE_STEPS,
    execute: async (collected, ctx) => {
      try {
        const { useStore } = await import("@/lib/store");
        await useStore.getState().addSale({
          medicationId: collected.medicationId,
          warehouseId: collected.warehouseId,
          quantity: Number(collected.quantity),
          price: Number(collected.price),
          prescription: collected.prescription && collected.prescription !== "no" ? collected.prescription : undefined,
        });
        const total = Number(collected.quantity) * Number(collected.price);
        return { success: true, message: `Venta registrada: ${collected.quantity} u. por $${total.toLocaleString("es-AR")}.` };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Error al registrar venta." };
      }
    },
    onComplete: "Venta registrada correctamente. ¿Necesitás algo más?",
  },
  dispensation: {
    id: "dispensation",
    name: "Dispensación",
    description: "Dispensar medicación a paciente internado",
    steps: DISPENSATION_STEPS,
    execute: async (collected) => {
      try {
        const { useStore } = await import("@/lib/store");
        await useStore.getState().addDispensation({
          medicationId: collected.medicationId,
          warehouseId: collected.warehouseId,
          quantity: Number(collected.quantity),
          doctor: collected.doctor,
          patient: collected.patientId,
          room: collected.room || "",
          treatment: collected.treatment,
        });
        return { success: true, message: `Dispensación registrada: ${collected.quantity} u. a ${collected.patientId}.` };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Error al registrar dispensación." };
      }
    },
    onComplete: "Dispensación registrada. ¿Algo más?",
  },
  order: {
    id: "order",
    name: "Pedido",
    description: "Crear pedido de medicación desde sala",
    steps: ORDER_STEPS,
    execute: async (collected) => {
      try {
        const { useStore } = await import("@/lib/store");
        await useStore.getState().createOrder({
          medicationId: collected.medicationId,
          sourceBatchId: "",
          warehouseId: collected.warehouseId,
          quantity: Number(collected.quantity),
          patient: collected.patient,
          room: collected.room,
          reason: collected.reason,
          doctorName: collected.doctorName,
        });
        return { success: true, message: `Pedido creado: ${collected.quantity} u. de medicación.` };
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : "Error al crear pedido." };
      }
    },
    onComplete: "Pedido registrado. ¿Necesitás algo más?",
  },
};

export function getWorkflowSteps(id: string): WorkflowStepDef[] | null {
  return WORKFLOWS[id]?.steps ?? null;
}

export function getCurrentStepPrompt(wf: ActiveWorkflow, ctx: WorkflowContext): string | null {
  const def = WORKFLOWS[wf.workflowId];
  if (!def) return null;
  const step = def.steps[wf.currentStep];
  if (!step) return null;
  if (step.options) {
    const ctxOpts = resolveStepOptions(step, ctx);
    if (ctxOpts.length > 0) {
      return `${step.prompt}\n\nOpciones:\n${ctxOpts.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;
    }
  }
  return step.prompt;
}

export function validateWorkflowStep(wf: ActiveWorkflow, value: string, ctx: WorkflowContext): string | null {
  const def = WORKFLOWS[wf.workflowId];
  if (!def) return "Workflow no encontrado.";
  const step = def.steps[wf.currentStep];
  if (!step) return "Paso no encontrado.";
  if (step.options) {
    const opts = resolveStepOptions(step, ctx);
    const idx = Number(value) - 1;
    if (value.match(/^\d+$/) && idx >= 0 && idx < opts.length) {
      return null;
    }
    const matched = opts.find((o) => o.value === value || o.label.toLowerCase().includes(value.toLowerCase()));
    if (matched) return null;
    if (opts.length > 0) {
      return `Elegí una opción válida (1-${opts.length}) o escribí el nombre exacto.`;
    }
  }
  return step.validate(value, ctx);
}

export function advanceWorkflow(wf: ActiveWorkflow, value: string, ctx: WorkflowContext): { wf: ActiveWorkflow; response: string } | { done: true; response: string } {
  const def = WORKFLOWS[wf.workflowId];
  if (!def) return { wf, response: "Error: workflow no encontrado." };
  const step = def.steps[wf.currentStep];
  if (!step) return { wf, response: "Error: paso no encontrado." };

  let resolvedValue = value;
  if (step.options) {
    const opts = resolveStepOptions(step, ctx);
    const idx = Number(value) - 1;
    if (value.match(/^\d+$/) && idx >= 0 && idx < opts.length) {
      resolvedValue = opts[idx].value;
    } else {
      const matched = opts.find((o) => o.value === value || o.label.toLowerCase().includes(value.toLowerCase()));
      if (matched) resolvedValue = matched.value;
    }
  }

  const nextCollected = { ...wf.collected, [step.field]: resolvedValue };
  const nextStep = wf.currentStep + 1;

  if (nextStep >= def.steps.length) {
    return { done: true, response: def.onComplete };
  }

  const newWf: ActiveWorkflow = { workflowId: wf.workflowId, currentStep: nextStep, collected: nextCollected };
  const nextPrompt = getCurrentStepPrompt(newWf, ctx);
  return { wf: newWf, response: nextPrompt ?? "Continuá con el siguiente paso." };
}

function resolveStepOptions(step: WorkflowStepDef, ctx: WorkflowContext): { label: string; value: string }[] {
  if (step.options) return step.options;
  if (step.field === "medicationId") {
    return ctx.medications.map((m) => ({ label: `${m.name} (${ctx.stockByMedication[m.id] ?? 0} u.)`, value: m.id }));
  }
  if (step.field === "warehouseId") {
    return ctx.warehouses.map((w) => ({ label: `${w.name} [${w.type}]`, value: w.id }));
  }
  if (step.field === "patientId") {
    return ctx.patients.map((p) => ({ label: `${p.firstName} ${p.lastName} — ${p.room}`, value: p.id }));
  }
  if (step.field === "room" && ctx.rooms.length > 0) {
    return ctx.rooms.map((r) => ({ label: `Sala ${r.fullNumber}`, value: String(r.fullNumber) }));
  }
  return [];
}

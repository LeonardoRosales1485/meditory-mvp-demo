import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  registerNameProvider,
  type AuditEntry,
  type Batch,
  type Dispensation,
  type Medication,
  type MedicationOrder,
  type Movement,
  type Sale,
  type TransferRequest,
  type Warehouse,
  type WorkspaceUserWarehouseAccess,
  type WorkspaceUser,
  type Patient,
} from "./domain-types";
import { fetchWorkspaceDataRpc, runActionRpc } from "./server-rpc";
import { supabase, isSupabaseConfigured } from "./supabase";

export type AppRole = "admin" | "ventas" | "doctor" | "tecnico";

export interface Session {
  email: string;
  name: string;
  role: AppRole;
  workspaceId: string;
  workspaceName: string;
}

interface CurrentUser {
  name: string;
  role: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMed = (r: any): Medication => ({ id: r.id, name: r.name, activeIngredient: r.active_ingredient, concentrationValue: Number(r.concentration_value ?? 0), concentrationUnit: r.concentration_unit ?? "mg", form: r.form });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapWH = (r: any): Warehouse => ({ id: r.id, name: r.name, type: r.type, unit: r.unit, workspaceId: r.workspace_id });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapBatch = (r: any): Batch => ({ id: r.id, medicationId: r.medication_id, warehouseId: r.warehouse_id, lot: r.lot, expiry: r.expiry, quantity: r.quantity });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMov = (r: any): Movement => ({ id: r.id, type: r.type, medicationId: r.medication_id, warehouseId: r.warehouse_id, quantity: r.quantity, user: r.user_name, reason: r.reason ?? "", lot: r.lot ?? undefined, date: r.date });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTx = (r: any): TransferRequest => ({ id: r.id, transferCode: r.transfer_code ?? undefined, medicationId: r.medication_id, sourceBatchId: r.source_batch_id ?? undefined, fromWarehouseId: r.from_warehouse_id, toWarehouseId: r.to_warehouse_id, quantity: r.quantity, status: r.status, requestedBy: r.requested_by, date: r.date });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSale = (r: any): Sale => ({ id: r.id, medicationId: r.medication_id, quantity: r.quantity, price: Number(r.price), prescription: r.prescription ?? undefined, doctor: r.doctor ?? undefined, cashier: r.cashier, date: r.date });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDisp = (r: any): Dispensation => ({ id: r.id, medicationId: r.medication_id, quantity: r.quantity, doctor: r.doctor, patient: r.patient, room: r.room, treatment: r.treatment, date: r.date });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOrder = (r: any): MedicationOrder => ({ id: r.id, medicationId: r.medication_id, sourceBatchId: r.source_batch_id ?? undefined, warehouseId: r.warehouse_id, quantity: r.quantity, doctor: r.doctor, patient: r.patient, room: r.room, reason: r.reason ?? "", status: r.status, requestedAt: r.requested_at, processedAt: r.processed_at ?? undefined, processedBy: r.processed_by ?? undefined });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapUser = (r: any): WorkspaceUser => ({ id: r.id, name: r.name, email: r.email, role: r.role, workspaceId: r.workspace_id });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapUserWarehouseAccess = (r: any): WorkspaceUserWarehouseAccess => ({ userId: r.user_id, warehouseId: r.warehouse_id });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPatient = (r: any): Patient => ({
  id: r.id,
  workspaceId: r.workspace_id,
  firstName: r.first_name,
  lastName: r.last_name,
  insurance: r.insurance,
  diagnosis: r.diagnosis,
  assignedDoctor: r.assigned_doctor,
  room: r.room,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAudit = (r: any): AuditEntry => ({ id: r.id, user: r.user_name, action: r.action, entity: r.entity, date: r.date });

// ─── Types ─────────────────────────────────────────────────────────────────
interface State {
  user: CurrentUser;
  session: Session | null;
  /** True mientras se ejecuta fetch de datos del workspace (post-login, F5, tras mutaciones). */
  workspaceDataLoading: boolean;
  warehouses: Warehouse[];

  batches: Batch[];
  medications: Medication[];
  movements: Movement[];
  transfers: TransferRequest[];
  sales: Sale[];
  dispensations: Dispensation[];
  orders: MedicationOrder[];
  users: WorkspaceUser[];
  patients: Patient[];
  userWarehouseAccesses: WorkspaceUserWarehouseAccess[];
  audit: AuditEntry[];

  login: (email: string) => Promise<Session | null>;
  logout: () => void;
  fetchWorkspaceData: (workspaceId: string) => Promise<void>;

  addMedication:    (m: Omit<Medication, "id">) => Promise<void>;
  updateMedication: (id: string, patch: Partial<Omit<Medication, "id">>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;

  adjustStock: (input: { batchId: string; delta: number; reason: string }) => Promise<void>;
  resetData: () => void;

  addReceipt: (input: {
    medicationId: string; warehouseId: string; lot: string;
    expiry: string; quantity: number; reason?: string;
  }) => Promise<void>;

  createTransfer: (input: {
    medicationId: string; sourceBatchId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number;
  }) => Promise<void>;

  advanceTransfer: (id: string) => Promise<void>;
  rejectTransfer: (id: string, reason: string, outcome: "devolver" | "descartar") => Promise<void>;

  addSale: (input: {
    medicationId: string; warehouseId: string; quantity: number;
    price: number; prescription?: string;
  }) => Promise<void>;

  addDispensation: (input: {
    medicationId: string; warehouseId: string; quantity: number;
    doctor: string; patient: string; room: string; treatment: string;
  }) => Promise<void>;

  createOrder: (input: {
    medicationId: string; sourceBatchId: string; warehouseId: string; quantity: number;
    doctorName?: string;
    patient: string; room: string; reason: string;
  }) => Promise<void>;

  processOrder: (
    id: string,
    action:
      | "aprobar"
      | "despachar"
      | "marcar_recibir"
      | "confirmar_recepcion"
      | "administrar"
      | "devolver_recibido"
      | "descartar_recibido"
      | "solicitar_devolucion"
      | "aprobar_devolucion"
      | "rechazar_devolucion"
      | "rechazar",
    reason?: string,
  ) => Promise<void>;

  addUser:    (input: Omit<WorkspaceUser, "id"> & { warehouseIds: string[] }) => Promise<void>;
  updateUser: (
    id: string,
    patch: Partial<Omit<WorkspaceUser, "id">> & { warehouseIds?: string[] },
  ) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addWarehouse: (input: { name: string; type: Warehouse["type"] }) => Promise<void>;
  updateWarehouse: (id: string, patch: { name?: string; type?: Warehouse["type"] }) => Promise<void>;
  deleteWarehouse: (id: string) => Promise<void>;
  resetWorkspaceDemo: () => Promise<void>;
  addPatient: (input: Omit<Patient, "id" | "workspaceId">) => Promise<void>;
  updatePatient: (id: string, patch: Partial<Omit<Patient, "id" | "workspaceId">>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin", ventas: "Ventas", doctor: "Doctor", tecnico: "Enfermero Jefe",
};

function parseEmail(email: string): Session | null {
  const e = email.trim().toLowerCase();
  const m = e.match(/^([a-z]+?)(admin|ventas|doctor|tecnico)@user\.com$/i);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const role = m[2].toLowerCase() as AppRole;
  const map: Record<string, { id: string; name: string }> = {
    hospitalaleman:   { id: "ws-aleman",    name: "Hospital Alemán" },
    hospitalfrancisco: { id: "ws-francisco", name: "Hospital Francisco" },
    hospitalblanco: { id: "ws-blanco", name: "Hospital Blanco" },
  };
  const ws = map[prefix];
  if (!ws) return null;
  const nameMap: Record<AppRole, string> = {
    admin: "Admin Demo", ventas: "Cajero Demo", doctor: "Doctor Demo", tecnico: "Enfermero Jefe Demo",
  };
  return { email: e, name: nameMap[role], role, workspaceId: ws.id, workspaceName: ws.name };
}

async function apiPost(action: string, payload: unknown) {
  await runActionRpc({ data: { action, payload } });
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      user: { name: "L. Rosales", role: "Admin cliente" },
      session: null,
      workspaceDataLoading: false,
      warehouses: [],
      batches: [],
      medications: [],
      movements: [],
      transfers: [],
      sales: [],
      dispensations: [],
      orders: [],
      users: [],
      patients: [],
      userWarehouseAccesses: [],
      audit: [],

      login: async (email) => {
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from("workspace_users")
            .select("*, workspace:workspaces(name)")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();

          if (error || !data) return null;

          const s: Session = {
            email: data.email,
            name: data.name,
            role: data.role as AppRole,
            workspaceId: data.workspace_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workspaceName: (data.workspace as any)?.name ?? "",
          };
          set({ session: s, user: { name: s.name, role: ROLE_LABELS[s.role] } });
          await get().fetchWorkspaceData(s.workspaceId);
          return s;
        }

        const s = parseEmail(email);
        if (!s) return null;
        set({ session: s, user: { name: s.name, role: ROLE_LABELS[s.role] } });
        await get().fetchWorkspaceData(s.workspaceId);
        return s;
      },

      logout: () => set({ session: null, workspaceDataLoading: false }),

      fetchWorkspaceData: async (workspaceId) => {
        set({ workspaceDataLoading: true });
        try {
          const data = (await fetchWorkspaceDataRpc({ data: { workspaceId } })) as {
            warehouses: object[];
            medications: object[];
            batches: object[];
            movements: object[];
            transfers: object[];
            sales: object[];
            dispensations: object[];
            orders: object[];
            users: object[];
            patients: object[];
            userWarehouseAccesses: object[];
            audit: object[];
          };

          set({
            warehouses: data.warehouses.map(mapWH),
            medications: data.medications.map(mapMed),
            batches: data.batches.map(mapBatch),
            movements: data.movements.map(mapMov),
            transfers: data.transfers.map(mapTx),
            sales: data.sales.map(mapSale),
            dispensations: data.dispensations.map(mapDisp),
            orders: data.orders.map(mapOrder),
            users: data.users.map(mapUser),
            patients: data.patients.map(mapPatient),
            userWarehouseAccesses: data.userWarehouseAccesses.map(mapUserWarehouseAccess),
            audit: data.audit.map(mapAudit),
          });
        } finally {
          set({ workspaceDataLoading: false });
        }
      },

      resetData: () => set({
        workspaceDataLoading: false,
        batches: [], medications: [], movements: [],
        transfers: [], sales: [], dispensations: [],
        orders: [], users: [], patients: [], userWarehouseAccesses: [], audit: [], warehouses: [],
      }),

      addMedication: async (m) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addMedication", { workspaceId: session.workspaceId, actor: user.name, medication: m });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      updateMedication: async (id, patch) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("updateMedication", { workspaceId: session.workspaceId, actor: user.name, id, patch });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      deleteMedication: async (id) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("deleteMedication", { workspaceId: session.workspaceId, actor: user.name, id });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      adjustStock: async ({ batchId, delta, reason }) => {
        const { session, user, batches } = get();
        const b = batches.find((x) => x.id === batchId);
        if (!b || !session) return;
        await apiPost("adjustStock", { workspaceId: session.workspaceId, actor: user.name, batchId, delta, reason });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addReceipt: async ({ medicationId, warehouseId, lot, expiry, quantity, reason }) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addReceipt", { workspaceId: session.workspaceId, actor: user.name, medicationId, warehouseId, lot, expiry, quantity, reason });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      createTransfer: async ({ medicationId, sourceBatchId, fromWarehouseId, toWarehouseId, quantity }) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("createTransfer", { workspaceId: session.workspaceId, actor: user.name, medicationId, sourceBatchId, fromWarehouseId, toWarehouseId, quantity });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      advanceTransfer: async (id) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("advanceTransfer", { workspaceId: session.workspaceId, actor: user.name, id });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      rejectTransfer: async (id, reason, outcome) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("rejectTransfer", { workspaceId: session.workspaceId, actor: user.name, id, reason, outcome });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addSale: async ({ medicationId, warehouseId, quantity, price, prescription }) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addSale", { workspaceId: session.workspaceId, actor: user.name, medicationId, warehouseId, quantity, price, prescription });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addDispensation: async ({ medicationId, warehouseId, quantity, doctor, patient, room, treatment }) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addDispensation", { workspaceId: session.workspaceId, actor: user.name, medicationId, warehouseId, quantity, doctor, patient, room, treatment });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      createOrder: async ({ medicationId, sourceBatchId, warehouseId, quantity, doctorName, patient, room, reason }) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("createOrder", { workspaceId: session.workspaceId, actor: user.name, medicationId, sourceBatchId, warehouseId, quantity, doctorName, patient, room, reason });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      processOrder: async (id, action, reason) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("processOrder", {
          workspaceId: session.workspaceId,
          actor: user.name,
          actorRole: session.role,
          id,
          action,
          reason,
        });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addUser: async (input) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addUser", { workspaceId: session.workspaceId, actor: user.name, user: input });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      updateUser: async (id, patch) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("updateUser", { workspaceId: session.workspaceId, actor: user.name, id, patch });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      deleteUser: async (id) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("deleteUser", { workspaceId: session.workspaceId, actor: user.name, id });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addWarehouse: async (input) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addWarehouse", {
          workspaceId: session.workspaceId,
          actor: user.name,
          warehouse: {
            name: input.name,
            type: input.type,
          },
        });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      updateWarehouse: async (id, patch) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("updateWarehouse", {
          workspaceId: session.workspaceId,
          actor: user.name,
          id,
          patch,
        });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      deleteWarehouse: async (id) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("deleteWarehouse", { workspaceId: session.workspaceId, actor: user.name, id });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      resetWorkspaceDemo: async () => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("resetWorkspace", { workspaceId: session.workspaceId, actor: user.name });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      addPatient: async (input) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("addPatient", { workspaceId: session.workspaceId, actor: user.name, patient: input });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      updatePatient: async (id, patch) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("updatePatient", { workspaceId: session.workspaceId, actor: user.name, id, patch });
        await get().fetchWorkspaceData(session.workspaceId);
      },

      deletePatient: async (id) => {
        const { session, user } = get();
        if (!session) return;
        await apiPost("deletePatient", { workspaceId: session.workspaceId, actor: user.name, id });
        await get().fetchWorkspaceData(session.workspaceId);
      },
    }),
    {
      name: "meditory-store",
      partialize: (s) => ({ session: s.session }),
    },
  ),
);

/**
 * Tras F5, solo se rehidrata `session` desde localStorage; el resto del estado arranca vacío.
 * Llamar esto cuando el cliente haya terminado de hidratar persist (p. ej. desde el layout /app).
 */
export function syncUserAndFetchWorkspaceAfterRehydrate() {
  const { session } = useStore.getState();
  if (!session?.workspaceId) return;
  useStore.setState({
    user: { name: session.name, role: ROLE_LABELS[session.role] },
    workspaceDataLoading: true,
  });
  void useStore.getState().fetchWorkspaceData(session.workspaceId);
}

// Keep medName/warehouseName resolved with live store data
useStore.subscribe((state) => {
  if (state.medications.length > 0 || state.warehouses.length > 0) {
    registerNameProvider({ medications: state.medications, warehouses: state.warehouses });
  }
});

// ─── Helpers used by routes ───────────────────────────────────────────────
export function stockFor(batches: Batch[], medicationId: string, warehouseId: string): number {
  return batches
    .filter((b) => b.medicationId === medicationId && b.warehouseId === warehouseId)
    .reduce((acc, b) => acc + b.quantity, 0);
}

export const ROLE_DISPLAY: Record<AppRole, string> = {
  admin: "Admin",
  ventas: "Ventas",
  doctor: "Doctor",
  tecnico: "Enfermero Jefe",
};

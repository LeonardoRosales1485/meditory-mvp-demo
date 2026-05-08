export interface Warehouse {
  id: string;
  name: string;
  type: "central" | "interna" | "ventas";
  unit: string;
  workspaceId: string;
}

export type ConcentrationUnit = "mg" | "mcg" | "ml" | "L" | "g" | "unidad";

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  concentrationValue: number;
  concentrationUnit: ConcentrationUnit;
  form: string;
}

export interface Batch {
  id: string;
  medicationId: string;
  warehouseId: string;
  lot: string;
  expiry: string;
  quantity: number;
}

export interface Movement {
  id: string;
  type: "ingreso" | "egreso" | "transferencia" | "venta" | "dispensacion" | "ajuste";
  medicationId: string;
  warehouseId: string;
  quantity: number;
  user: string;
  reason: string;
  lot?: string;
  date: string;
}

export interface TransferRequest {
  id: string;
  transferCode?: string;
  medicationId: string;
  sourceBatchId?: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  status: "solicitado" | "autorizado" | "despachado" | "recibir" | "recibido" | "aceptado" | "rechazado";
  requestedBy: string;
  date: string;
}

export interface Sale {
  id: string;
  medicationId: string;
  quantity: number;
  price: number;
  prescription?: string;
  doctor?: string;
  cashier: string;
  date: string;
}

export interface Dispensation {
  id: string;
  medicationId: string;
  quantity: number;
  doctor: string;
  patient: string;
  room: string;
  treatment: string;
  date: string;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  entity: string;
  date: string;
}

export interface MedicationOrder {
  id: string;
  medicationId: string;
  sourceBatchId?: string;
  warehouseId: string;
  quantity: number;
  doctor: string;
  patient: string;
  room: string;
  reason: string;
  status:
    | "pendiente"
    | "aprobado"
    | "despachado"
    | "recibir"
    | "recibido"
    | "administrado"
    | "rechazado"
    | "devolucion_solicitada"
    | "devuelto"
    | "devolucion_rechazada";
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "ventas" | "doctor" | "tecnico";
  workspaceId: string;
}

export interface WorkspaceUserWarehouseAccess {
  userId: string;
  warehouseId: string;
}

export interface Patient {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  insurance: string;
  diagnosis: string;
  assignedDoctor: string;
  room: string;
}

type NameProvider = { medications: Medication[]; warehouses: Warehouse[] };
let nameProvider: NameProvider | null = null;

export function registerNameProvider(provider: NameProvider) {
  nameProvider = provider;
}

export function daysUntil(date: string): number {
  return Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(expiry: string): "vencido" | "critico" | "proximo" | "ok" {
  const days = daysUntil(expiry);
  if (days < 0) return "vencido";
  if (days <= 30) return "critico";
  if (days <= 90) return "proximo";
  return "ok";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function medConc(m: Medication): string {
  return `${m.concentrationValue}${m.concentrationUnit}`;
}

export function medName(id: string): string {
  const list = nameProvider?.medications ?? [];
  const med = list.find((item) => item.id === id);
  return med ? `${med.name} ${medConc(med)}` : id;
}

export function warehouseName(id: string): string {
  const list = nameProvider?.warehouses ?? [];
  return list.find((item) => item.id === id)?.name ?? id;
}

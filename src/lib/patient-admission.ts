/** Estado de admisión mostrado en listados (sin columna en BD por ahora). */
export type AdmissionDisplayStatus = "internado" | "alta" | "temporal";

/**
 * - Internado: tiene cama asignada en `beds`, o solo en datos demo, `patient.room` no vacío.
 * - Alta: sin cama y sin texto de sala.
 * - Temporal: reservado para flujos futuros; hoy no se asigna desde la app.
 */
export function getAdmissionDisplayStatus(
  patientId: string,
  patientToBed: Map<string, unknown>,
  patientRoom: string,
): AdmissionDisplayStatus {
  if (patientToBed.has(patientId)) return "internado";
  if (patientRoom.trim() !== "") return "internado";
  return "alta";
}

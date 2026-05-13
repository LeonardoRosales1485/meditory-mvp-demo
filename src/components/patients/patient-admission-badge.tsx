import { Badge } from "@/components/ui/badge";
import type { AdmissionDisplayStatus } from "@/lib/patient-admission";

const LABELS: Record<AdmissionDisplayStatus, string> = {
  internado: "Internado",
  alta: "Alta",
  temporal: "Temporal",
};

export function PatientAdmissionBadge({ status }: { status: AdmissionDisplayStatus }) {
  if (status === "internado") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
        {LABELS.internado}
      </Badge>
    );
  }
  if (status === "temporal") {
    return (
      <Badge variant="secondary" className="pointer-events-none opacity-70" title="Reservado para un flujo futuro">
        {LABELS.temporal}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {LABELS.alta}
    </Badge>
  );
}

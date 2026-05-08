import { Loader2 } from "lucide-react";

type Props = {
  title?: string;
  description?: string;
};

export function WorkspaceLoadingPlaceholder({
  title = "Cargando",
  description = "Obteniendo datos del workspace…",
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30 opacity-40" />
        <Loader2 className="relative h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StockConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicationName: string;
  warehouseName: string;
  workspaceName: string;
  currentMin: number;
  currentOpt: number;
  currentQty: number;
  onSave: (minStock: number, optimalStock: number) => Promise<void>;
}

export function StockConfigDialog({
  open,
  onOpenChange,
  medicationName,
  warehouseName,
  workspaceName,
  currentMin,
  currentOpt,
  currentQty,
  onSave,
}: StockConfigDialogProps) {
  const [minStock, setMinStock] = useState(currentMin);
  const [optimalStock, setOptimalStock] = useState(currentOpt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMinStock(currentMin);
    setOptimalStock(currentOpt);
    setError(null);
  }

  async function handleSave() {
    if (minStock < 0) { setError("El stock mínimo no puede ser negativo"); return; }
    if (optimalStock <= minStock) { setError("El stock óptimo debe ser mayor al mínimo"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(minStock, optimalStock);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar stock mínimo/óptimo</DialogTitle>
          <DialogDescription>
            {medicationName} — {warehouseName} ({workspaceName})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Stock actual: </span>
            <span className="font-bold">{currentQty.toLocaleString("es-AR")} uds</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Stock Mínimo</label>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(Math.max(0, Number(e.target.value)))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Stock Óptimo</label>
              <input
                type="number"
                min={0}
                value={optimalStock}
                onChange={(e) => setOptimalStock(Math.max(0, Number(e.target.value)))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-red-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, Fragment } from "react";
import { motion } from "framer-motion";
import {
  Package, Search, AlertCircle, ArrowLeftRight, Filter, TrendingDown, TrendingUp,
  RefreshCw, CalendarDays, Building2, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { daysUntil, expiryStatus } from "@/lib/domain-types";
import type { CrossHospitalMedStock, LowStockMedication } from "@/lib/server/backoffice-service";

export const Route = createFileRoute("/backoffice/control-stock")({
  component: ControlStockPage,
});

const EXPIRY_STATUS_COLORS: Record<string, string> = {
  vencido: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  critico: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  proximo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  ok: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const EXPIRY_STATUS_LABELS: Record<string, string> = {
  vencido: "Vencido",
  critico: "Crítico (<30d)",
  proximo: "Próximo (<90d)",
  ok: "OK",
};

const TRANSFER_STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  autorizado: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  despachado: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  recibir: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  recibido: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  aceptado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  autorizado: "Autorizado",
  despachado: "Despachado",
  recibir: "Pendiente Recepción",
  recibido: "Recibido",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

function ControlStockPage() {
  const [tab, setTab] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWs, setSelectedWs] = useState<string>("__all__");
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);

  // Tab 1 — Stock
  const [crossStock, setCrossStock] = useState<CrossHospitalMedStock[]>([]);
  const [allMeds, setAllMeds] = useState<{ id: string; name: string; form: string }[]>([]);
  const [searchMed, setSearchMed] = useState("");

  // Tab 2 — Vencimientos
  const [batches, setBatches] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; workspace_id: string }[]>([]);
  const [searchBatch, setSearchBatch] = useState("");

  // Tab 3 — Alertas
  const [lowStock, setLowStock] = useState<LowStockMedication[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Tab 4 — Transferencias
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [tFormMed, setTFormMed] = useState("");
  const [tFormFrom, setTFormFrom] = useState("");
  const [tFormTo, setTFormTo] = useState("");
  const [tFormQty, setTFormQty] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTransfer, setSearchTransfer] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState("all");
  const [searchDeficit, setSearchDeficit] = useState("");
  const [deficitHospital, setDeficitHospital] = useState("all");
  const [deficitSeverity, setDeficitSeverity] = useState("all");
  const [searchSuggestion, setSearchSuggestion] = useState("");
  const [suggestionDeficitHospital, setSuggestionDeficitHospital] = useState("all");
  const [suggestionSurplusHospital, setSuggestionSurplusHospital] = useState("all");
  const [deficitPage, setDeficitPage] = useState(0);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const ITEMS_PER_PAGE = 8;
  const [transferFilter, setTransferFilter] = useState("all");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const rpc = await import("@/lib/server-rpc");

      const [cs, meds, rt, ls, wss] = await Promise.all([
        rpc.backofficeGetCrossHospitalStockRpc().catch(() => []),
        rpc.backofficeGetAllMedicationsRpc().catch(() => []),
        rpc.backofficeGetRealtimeDataRpc({ data: {} }).catch(() => ({
          batches: [], movements: [], orders: [], transfers: [],
          warehouses: [], medications: [], stockConfig: [],
        })),
        rpc.licitacionesGetLowStockRpc().catch(() => []),
        rpc.licitacionesGetWorkspacesRpc().catch(() => []),
      ]);

      setCrossStock(cs as CrossHospitalMedStock[]);
      setAllMeds(meds as { id: string; name: string; form: string }[]);
      setLowStock(ls as LowStockMedication[]);
      setWorkspaces(wss as { id: string; name: string }[]);

      const rtData = rt as {
        batches: any[]; transfers: any[];
        warehouses: { id: string; name: string; workspace_id: string }[];
        medications: any[];
      };
      setBatches(rtData.batches);
      setTransfers(rtData.transfers);
      setWarehouses(rtData.warehouses);
      setMedications(rtData.medications);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // ── Derived ──
  const selectedWsName = selectedWs === "__all__" ? null : workspaces.find((ws) => ws.id === selectedWs)?.name ?? null;

  const medMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const med of medications) m.set(med.id, med.name);
    for (const med of allMeds) if (!m.has(med.id)) m.set(med.id, med.name);
    return m;
  }, [medications, allMeds]);

  const whMap = useMemo(() => {
    const m = new Map(warehouses.map((w) => [w.id, w.name]));
    return m;
  }, [warehouses]);

  const workspaceByWarehouse = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) {
      m.set(w.id, w.workspace_id);
    }
    return m;
  }, [warehouses]);

  const whFullMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) {
      const wsName = workspaces.find((ws) => ws.id === w.workspace_id)?.name ?? "";
      m.set(w.id, wsName ? `${wsName} - ${w.name}` : w.name);
    }
    return m;
  }, [warehouses, workspaces]);

  // ── Tab 1: Filtered cross stock ──
  const filteredCrossStock = useMemo(() => {
    let list = crossStock;
    if (selectedWs !== "__all__" && selectedWsName) {
      list = list
        .map((m) => ({
          ...m,
          stocks: m.stocks.filter((s) => s.workspaceName === selectedWsName),
        }))
        .filter((m) => m.stocks.length > 0);
    }
    if (searchMed) {
      const q = searchMed.toLowerCase();
      list = list.filter((m) => m.medicationName.toLowerCase().includes(q));
    }
    return list;
  }, [crossStock, selectedWs, selectedWsName, searchMed]);

  // ── Tab 2: Filtered batches ──
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (selectedWs !== "__all__" && selectedWsName) {
      const wsWhIds = new Set(
        warehouses.filter((w) => w.workspace_id === selectedWs).map((w) => w.id)
      );
      list = list.filter((b) => wsWhIds.has(b.warehouse_id));
    }
    if (searchBatch) {
      const q = searchBatch.toLowerCase();
      list = list.filter((b) => {
        const medName = medMap.get(b.medication_id) ?? "";
        const whName = whMap.get(b.warehouse_id) ?? "";
        return medName.toLowerCase().includes(q) || whName.toLowerCase().includes(q) ||
          (b.lot ?? "").toLowerCase().includes(q);
      });
    }
    return list.filter((b) => {
      if (!b.expiry) return false;
      const days = daysUntil(b.expiry);
      return days < 90;
    }).sort((a, b) => {
      return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
    });
  }, [batches, selectedWs, selectedWsName, warehouses, searchBatch, medMap, whMap]);

  // ── Tab 3: Alert suggestions (system-generated) ──
  const suggestions = useMemo(() => {
    const result: {
      medicationName: string;
      medicationId: string;
      deficitWorkspace: string;
      deficitWarehouse: string;
      deficit: number;
      surplusWorkspace: string;
      surplusWarehouse: string;
      surplus: number;
      suggestedQty: number;
      potentialSaving: number;
    }[] = [];

    for (const med of filteredCrossStock) {
      const deficitStocks = med.stocks.filter((s) => s.minStock > 0 && s.quantity < s.minStock);
      const surplusStocks = med.stocks.filter((s) => s.optimalStock > 0 && s.quantity > s.optimalStock);

      for (const deficit of deficitStocks) {
        for (const surplus of surplusStocks) {
          const deficitQty = deficit.minStock - deficit.quantity;
          const surplusQty = surplus.quantity - surplus.optimalStock;
          const suggestedQty = Math.min(deficitQty, surplusQty);
          if (suggestedQty <= 0) continue;

          result.push({
            medicationName: med.medicationName,
            medicationId: surplus.medicationId,
            deficitWorkspace: deficit.workspaceName,
            deficitWarehouse: deficit.warehouseId,
            deficit: deficitQty,
            surplusWorkspace: surplus.workspaceName,
            surplusWarehouse: surplus.warehouseId,
            surplus: surplusQty,
            suggestedQty,
            potentialSaving: suggestedQty * med.salePrice,
          });
        }
      }
    }

    return result.sort((a, b) => b.suggestedQty - a.suggestedQty);
  }, [filteredCrossStock]);

  // ── Tab 4: Filtered transfers ──
  const filteredTransfers = useMemo(() => {
    let list = transfers;
    if (selectedWs !== "__all__" && selectedWsName) {
      const wsWhIds = new Set(
        warehouses.filter((w) => w.workspace_id === selectedWs).map((w) => w.id)
      );
      list = list.filter((t) => wsWhIds.has(t.from_warehouse_id) || wsWhIds.has(t.to_warehouse_id));
    }
    if (searchTransfer) {
      const q = searchTransfer.toLowerCase();
      list = list.filter((t) => {
        const medName = medMap.get(t.medication_id) ?? "";
        const fromName = whFullMap.get(t.from_warehouse_id) ?? "";
        const toName = whFullMap.get(t.to_warehouse_id) ?? "";
        return medName.toLowerCase().includes(q) || fromName.toLowerCase().includes(q) ||
          toName.toLowerCase().includes(q) || (t.transfer_code ?? "").toLowerCase().includes(q);
      });
    }
    return list.sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
    );
  }, [transfers, selectedWs, selectedWsName, warehouses, searchTransfer, medMap, whFullMap]);

  // ── Status filter options ──
  const STOCK_FILTERS = [
    { value: "all", label: "Todos" },
    { value: "deficit", label: "Con déficit" },
    { value: "surplus", label: "Con superávit" },
    { value: "normal", label: "Normal" },
  ];

  const EXPIRY_FILTERS = [
    { value: "all", label: "Todos" },
    { value: "vencido", label: "Vencido" },
    { value: "critico", label: "Crítico (<30d)" },
    { value: "proximo", label: "Próximo (<90d)" },
  ];

  const ALERT_FILTERS = [
    { value: "all", label: "Todos los déficits" },
    { value: "with_suggestion", label: "Con sugerencia" },
    { value: "without_suggestion", label: "Sin sugerencia" },
  ];

  const TRANSFER_FILTERS = [
    { value: "all", label: "Todos" },
    { value: "solicitado", label: "Solicitado" },
    { value: "autorizado", label: "Autorizado" },
    { value: "despachado", label: "Despachado" },
    { value: "recibir", label: "Pendiente Recepción" },
    { value: "recibido", label: "Recibido" },
    { value: "aceptado", label: "Aceptado" },
    { value: "rechazado", label: "Rechazado" },
  ];

  // ── Tab 1: Status-filtered stock ──
  const statusFilteredStock = useMemo(() => {
    let list = filteredCrossStock;
    if (stockFilter === "deficit") {
      list = list.filter((m) => {
        const totalMin = m.stocks.reduce((s, ws) => s + ws.minStock, 0);
        const totalStock = m.stocks.reduce((s, ws) => s + ws.quantity, 0);
        return totalMin > totalStock;
      });
    } else if (stockFilter === "surplus") {
      list = list.filter((m) => {
        const totalOpt = m.stocks.reduce((s, ws) => s + ws.optimalStock, 0);
        const totalStock = m.stocks.reduce((s, ws) => s + ws.quantity, 0);
        return totalStock > totalOpt;
      });
    } else if (stockFilter === "normal") {
      list = list.filter((m) => {
        const totalMin = m.stocks.reduce((s, ws) => s + ws.minStock, 0);
        const totalOpt = m.stocks.reduce((s, ws) => s + ws.optimalStock, 0);
        const totalStock = m.stocks.reduce((s, ws) => s + ws.quantity, 0);
        return totalStock >= totalMin && totalStock <= totalOpt;
      });
    }
    return list;
  }, [filteredCrossStock, stockFilter]);

  // ── Tab 2: Status-filtered batches ──
  const statusFilteredBatches = useMemo(() => {
    if (expiryFilter === "all") return filteredBatches;
    return filteredBatches.filter((b) => expiryStatus(b.expiry) === expiryFilter);
  }, [filteredBatches, expiryFilter]);

  // ── Tab 3: Status-filtered alerts ──
  const filteredAlerts = useMemo(() => {
    if (alertFilter === "all") return { lowStock, suggestions };
    if (alertFilter === "with_suggestion") {
      const suggestionMedIds = new Set(suggestions.map((s) => s.medicationId));
      return {
        lowStock: lowStock.filter((l) => suggestionMedIds.has(l.medicationId)),
        suggestions,
      };
    }
    if (alertFilter === "without_suggestion") {
      const suggestionMedIds = new Set(suggestions.map((s) => s.medicationId));
      return {
        lowStock: lowStock.filter((l) => !suggestionMedIds.has(l.medicationId)),
        suggestions: [],
      };
    }
    return { lowStock, suggestions };
  }, [lowStock, suggestions, alertFilter]);

  const deficitHospitals = useMemo(() =>
    [...new Set(filteredAlerts.lowStock.map((l) => l.workspaceName))].sort(),
    [filteredAlerts.lowStock],
  );

  const displayedDeficit = useMemo(() => {
    let list = filteredAlerts.lowStock;
    if (searchDeficit) {
      const q = searchDeficit.toLowerCase();
      list = list.filter((l) =>
        l.medicationName.toLowerCase().includes(q) || l.workspaceName.toLowerCase().includes(q),
      );
    }
    if (deficitHospital !== "all") list = list.filter((l) => l.workspaceName === deficitHospital);
    if (deficitSeverity === "critical") list = list.filter((l) => l.currentStock === 0);
    else if (deficitSeverity === "high") list = list.filter((l) => l.currentStock > 0 && l.deficit / l.minStock > 0.5);
    else if (deficitSeverity === "moderate") list = list.filter((l) => l.currentStock > 0 && l.deficit / l.minStock <= 0.5);
    return list;
  }, [filteredAlerts.lowStock, searchDeficit, deficitHospital, deficitSeverity]);

  const suggestionDeficitHospitals = useMemo(() =>
    [...new Set(filteredAlerts.suggestions.map((s) => s.deficitWorkspace))].sort(),
    [filteredAlerts.suggestions],
  );

  const suggestionSurplusHospitals = useMemo(() =>
    [...new Set(filteredAlerts.suggestions.map((s) => s.surplusWorkspace))].sort(),
    [filteredAlerts.suggestions],
  );

  const displayedSuggestions = useMemo(() => {
    let list = filteredAlerts.suggestions;
    if (searchSuggestion) {
      const q = searchSuggestion.toLowerCase();
      list = list.filter((s) => s.medicationName.toLowerCase().includes(q));
    }
    if (suggestionDeficitHospital !== "all") list = list.filter((s) => s.deficitWorkspace === suggestionDeficitHospital);
    if (suggestionSurplusHospital !== "all") list = list.filter((s) => s.surplusWorkspace === suggestionSurplusHospital);
    return list;
  }, [filteredAlerts.suggestions, searchSuggestion, suggestionDeficitHospital, suggestionSurplusHospital]);

  // ── Tab 4: Status-filtered transfers ──
  const statusFilteredTransfers = useMemo(() => {
    if (transferFilter === "all") return filteredTransfers;
    return filteredTransfers.filter((t) => t.status === transferFilter);
  }, [filteredTransfers, transferFilter]);

  const transferInfo = useMemo(() => {
    if (!tFormMed) return null;

    // Each hospital has its own UUID per medication — resolve by name across workspaces.
    const medName = medMap.get(tFormMed);
    const crossEntry = medName
      ? crossStock.find((m) => m.medicationName.toLowerCase() === medName.toLowerCase())
      : null;

    // Get the workspace-specific medication ID for a given warehouse (fallback to tFormMed for same-workspace).
    const medIdFor = (warehouseId: string): string => {
      const wsId = workspaceByWarehouse.get(warehouseId);
      if (!wsId || !crossEntry) return tFormMed;
      return crossEntry.stocks.find((s) => s.workspaceId === wsId)?.medicationId ?? tFormMed;
    };

    const stockAt = (warehouseId: string) =>
      batches
        .filter((b) => b.medication_id === medIdFor(warehouseId) && b.warehouse_id === warehouseId)
        .reduce((sum, b) => sum + b.quantity, 0);

    const wsStockEntry = (warehouseId: string) => {
      const wsId = workspaceByWarehouse.get(warehouseId);
      if (!wsId || !crossEntry) return null;
      return crossEntry.stocks.find((s) => s.workspaceId === wsId) ?? null;
    };

    const fromStock = tFormFrom ? stockAt(tFormFrom) : null;
    const from = tFormFrom ? {
      hospitalName: whFullMap.get(tFormFrom) ?? whMap.get(tFormFrom) ?? tFormFrom,
      currentStock: fromStock!,
      afterTransfer: fromStock! - tFormQty,
    } : null;

    const toCurrentStock = tFormTo ? stockAt(tFormTo) : null;
    const toCrossEntry = tFormTo ? wsStockEntry(tFormTo) : null;
    const to = tFormTo ? {
      hospitalName: whFullMap.get(tFormTo) ?? whMap.get(tFormTo) ?? tFormTo,
      currentStock: toCurrentStock!,
      afterTransfer: toCurrentStock! + tFormQty,
      minStock: toCrossEntry?.minStock ?? null,
      optimalStock: toCrossEntry?.optimalStock ?? null,
      deficit: toCrossEntry ? Math.max(0, toCrossEntry.minStock - toCurrentStock!) : null,
    } : null;

    return { from, to };
  }, [tFormMed, tFormFrom, tFormTo, tFormQty, batches, crossStock, workspaceByWarehouse, whFullMap, whMap, medMap]);

  const lowStockBatchInfo = useMemo(() => {
    const info = new Map<string, { expiry: Date | null; daysUntil: number | null }>();
    const wsWhIds = new Map<string, string[]>();
    for (const w of warehouses) {
      const list = wsWhIds.get(w.workspace_id) ?? [];
      list.push(w.id);
      wsWhIds.set(w.workspace_id, list);
    }
    for (const item of lowStock) {
      const key = `${item.medicationId}::${item.workspaceId}`;
      const whIds = wsWhIds.get(item.workspaceId) ?? [];
      const matchingBatches = batches.filter(
        (b) => b.medication_id === item.medicationId && whIds.includes(b.warehouse_id) && b.expiry
      );
      if (matchingBatches.length === 0) {
        info.set(key, { expiry: null, daysUntil: null });
        continue;
      }
      let earliest: Date | null = null;
      for (const b of matchingBatches) {
        const d = new Date(b.expiry);
        if (!earliest || d < earliest) earliest = d;
      }
      info.set(key, {
        expiry: earliest,
        daysUntil: earliest ? daysUntil(earliest.toISOString()) : null,
      });
    }
    return info;
  }, [lowStock, warehouses, batches]);

  const wsWarehouses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const w of warehouses) {
      const list = map.get(w.workspace_id) ?? [];
      list.push({ id: w.id, name: w.name });
      map.set(w.workspace_id, list);
    }
    return map;
  }, [warehouses]);

  async function handleCreateTransfer() {
    if (!tFormMed || !tFormFrom || !tFormTo || tFormQty <= 0) {
      toast.error("Completá todos los campos");
      return;
    }
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeCreateOverstockTransferRpc({
        data: {
          medicationId: tFormMed,
          fromWarehouseId: tFormFrom,
          toWarehouseId: tFormTo,
          quantity: tFormQty,
          requestedBy: "Admin",
        },
      });
      toast.success("Transferencia creada");
      setTransferOpen(false);
      setTFormMed("");
      setTFormFrom("");
      setTFormTo("");
      setTFormQty(1);
      loadAll();
    } catch {
      toast.error("Error al crear transferencia");
    }
  }

  async function handleAdvanceTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeAdvanceTransferRpc({ data: { id } });
      setTransfers((prev) => prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status:
                t.status === "solicitado" ? "autorizado"
                : t.status === "autorizado" ? "despachado"
                : t.status === "despachado" ? "recibir"
                : t.status === "recibir" ? "recibido"
                : "aceptado",
            }
          : t
      ));
    } catch {
      toast.error("Error al avanzar transferencia");
    }
  }

  async function handleCancelTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeCancelTransferRpc({ data: { id } });
      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: "rechazado" } : t
      ));
      toast.success("Transferencia cancelada");
    } catch {
      toast.error("Error al cancelar transferencia");
    }
  }

  async function handleRejectTransfer(id: string) {
    try {
      const rpc = await import("@/lib/server-rpc");
      await rpc.backofficeRejectTransferRpc({
        data: { id, reason: "Rechazado por administrador", outcome: "devolver" },
      });
      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: "rechazado" } : t
      ));
      toast.success("Transferencia rechazada");
    } catch {
      toast.error("Error al rechazar transferencia");
    }
  }

  async function refreshSuggestions() {
    setSuggestionsLoading(true);
    try {
      const rpc = await import("@/lib/server-rpc");
      const cs = await rpc.backofficeGetCrossHospitalStockRpc().catch(() => []);
      setCrossStock(cs as CrossHospitalMedStock[]);
      toast.success("Sugerencias actualizadas");
    } catch {
      toast.error("Error al actualizar sugerencias");
    } finally {
      setSuggestionsLoading(false);
    }
  }

  // ── Render ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Package size={40} className="text-primary" />
        </motion.div>
        <p className="text-muted-foreground">Cargando control de stock…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-red-600">
        <p className="font-medium">{error}</p>
        <Button variant="outline" onClick={loadAll}>
          <RefreshCw size={16} className="mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  const deficitCount = lowStock.length;
  const expiringCount = batches.filter((b) => {
    if (!b.expiry) return false;
    const days = daysUntil(b.expiry);
    return days >= 0 && days < 90;
  }).length;
  const expiredCount = batches.filter((b) => {
    if (!b.expiry) return false;
    return daysUntil(b.expiry) < 0;
  }).length;
  const activeTransfers = transfers.filter(
    (t) => !["recibido", "rechazado", "aceptado"].includes(t.status)
  ).length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Package className="text-primary" size={26} />
        <div>
          <h1 className="text-2xl font-bold">Control de stock</h1>
          <p className="text-sm text-muted-foreground">
            {selectedWs === "__all__" ? "Visión consolidada de todos los hospitales" : selectedWsName}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedWs} onValueChange={setSelectedWs}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los hospitales</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
            <RefreshCw size={14} /> Actualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package size={16} />
              <span className="text-xs font-medium">Stock General</span>
            </div>
            <p className="text-2xl font-black">{crossStock.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">medicamentos monitoreados</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Alertas</span>
            </div>
            <p className="text-2xl font-black">{deficitCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">medicamentos con déficit</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <CalendarDays size={16} />
              <span className="text-xs font-medium">Vencimientos</span>
            </div>
            <p className="text-2xl font-black">{expiredCount + expiringCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{expiredCount} vencidos + {expiringCount} próximos</p>
          </CardContent>
        </Card>
        <Card className="cursor-default transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <ArrowLeftRight size={16} />
              <span className="text-xs font-medium">Transferencias</span>
            </div>
            <p className="text-2xl font-black">{activeTransfers} <span className="text-base font-normal text-muted-foreground">/ {transfers.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">activas / total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="stock" className="gap-1.5 text-xs"><Package size={14} />Stock</TabsTrigger>
          <TabsTrigger value="vencimientos" className="gap-1.5 text-xs"><CalendarDays size={14} />Vencimientos</TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5 text-xs"><AlertCircle size={14} />Alertas</TabsTrigger>
          <TabsTrigger value="transferencias" className="gap-1.5 text-xs"><ArrowLeftRight size={14} />Transferencias</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Stock ─── */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por medicamento..."
                value={searchMed}
                onChange={(e) => setSearchMed(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              {statusFilteredStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchMed ? "Sin resultados" : "No hay datos de stock"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6"></TableHead>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Precio</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Déficit</TableHead>
                      <TableHead className="text-xs text-right">Superávit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusFilteredStock.slice(0, 100).map((item, idx) => {
                      const totalStock = item.stocks.reduce((s, ws) => s + ws.quantity, 0);
                      const totalMin = item.stocks.reduce((s, ws) => s + ws.minStock, 0);
                      const totalOpt = item.stocks.reduce((s, ws) => s + ws.optimalStock, 0);
                      const deficit = Math.max(0, totalMin - totalStock);
                      const surplus = Math.max(0, totalStock - totalOpt);
                      const isExpanded = expandedRow === item.medicationName;
                      return (
                        <Fragment key={item.medicationName + "::" + idx}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedRow(isExpanded ? null : item.medicationName)}
                          >
                            <TableCell className="text-xs text-muted-foreground">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              ${item.salePrice.toLocaleString("es-AR")}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              {totalStock.toLocaleString("es-AR")}
                            </TableCell>
                            <TableCell className="text-right">
                              {deficit > 0 ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  -{deficit.toLocaleString("es-AR")}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {surplus > 0 ? (
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] border-0">
                                  +{surplus.toLocaleString("es-AR")}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={item.medicationName + "::detail::" + idx}>
                              <TableCell colSpan={6} className="p-0 bg-muted/20">
                                <div className="mx-6 my-2 rounded-md border border-border/50 overflow-hidden">
                                  <div className="grid grid-cols-[1fr_72px_72px_72px_120px_72px] gap-x-3 px-4 py-1.5 bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    <span>Hospital</span>
                                    <span className="text-right">Stock</span>
                                    <span className="text-right">Mínimo</span>
                                    <span className="text-right">Óptimo</span>
                                    <span className="pl-1">Nivel</span>
                                    <span className="text-right">Estado</span>
                                  </div>
                                  {item.stocks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-4 py-3">Sin stock en ningún depósito</p>
                                  ) : (
                                    item.stocks.map((s, si) => {
                                      const isDeficit = s.quantity < s.minStock;
                                      const isSurplus = s.quantity > s.optimalStock;
                                      const pct = s.optimalStock > 0
                                        ? Math.min(100, Math.round((s.quantity / s.optimalStock) * 100))
                                        : 0;
                                      return (
                                        <div
                                          key={s.warehouseId}
                                          className={[
                                            "grid grid-cols-[1fr_72px_72px_72px_120px_72px] gap-x-3 px-4 py-2 text-xs items-center",
                                            si < item.stocks.length - 1 ? "border-b border-border/30" : "",
                                            isDeficit ? "bg-red-50/60 dark:bg-red-950/20" : isSurplus ? "bg-blue-50/40 dark:bg-blue-950/10" : "",
                                          ].join(" ")}
                                        >
                                          <span className="font-medium truncate">{s.workspaceName}</span>
                                          <span className={`text-right font-semibold tabular-nums ${isDeficit ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                                            {s.quantity.toLocaleString("es-AR")}
                                          </span>
                                          <span className="text-right text-muted-foreground tabular-nums">
                                            {s.minStock.toLocaleString("es-AR")}
                                          </span>
                                          <span className="text-right text-muted-foreground tabular-nums">
                                            {s.optimalStock.toLocaleString("es-AR")}
                                          </span>
                                          <div className="flex items-center gap-2 pl-1">
                                            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${isDeficit ? "bg-red-500" : isSurplus ? "bg-blue-500" : "bg-green-500"}`}
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</span>
                                          </div>
                                          <div className="flex justify-end">
                                            {isDeficit ? (
                                              <Badge variant="destructive" className="text-[10px] px-1.5 h-5 font-medium">
                                                -{(s.minStock - s.quantity).toLocaleString("es-AR")}
                                              </Badge>
                                            ) : isSurplus ? (
                                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-1.5 h-5 border-0 font-medium">
                                                +{(s.quantity - s.optimalStock).toLocaleString("es-AR")}
                                              </Badge>
                                            ) : (
                                              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">OK</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Vencimientos ─── */}
        <TabsContent value="vencimientos" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por medicamento, lote o depósito..."
                value={searchBatch}
                onChange={(e) => setSearchBatch(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Lotes con vencimiento &lt; 90 días
            </span>
          </div>
          <Card>
            <CardContent className="p-0">
              {statusFilteredBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchBatch ? "Sin resultados" : "No hay lotes próximos a vencer"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Lote</TableHead>
                      <TableHead className="text-xs">Depósito</TableHead>
                      <TableHead className="text-xs text-right">Cantidad</TableHead>
                      <TableHead className="text-xs">Vencimiento</TableHead>
                      <TableHead className="text-xs">Faltan</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusFilteredBatches.map((b, idx) => {
                      const days = daysUntil(b.expiry);
                      const status = expiryStatus(b.expiry);
                      const whFull = whFullMap.get(b.warehouse_id) ?? whMap.get(b.warehouse_id) ?? b.warehouse_id?.slice(0, 8);
                      return (
                        <TableRow key={b.id ?? idx}>
                          <TableCell className="text-sm font-medium">
                            {medMap.get(b.medication_id) ?? b.medication_id?.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{b.lot ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{whFull}</TableCell>
                          <TableCell className="text-right text-sm">{b.quantity.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(b.expiry).toLocaleDateString("es-AR")}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={days < 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                              {days < 0 ? `venció hace ${Math.abs(days)}d` : `en ${days}d`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${EXPIRY_STATUS_COLORS[status] ?? ""}`}
                            >
                              {EXPIRY_STATUS_LABELS[status] ?? status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-200 dark:bg-red-800" />
              Vencido
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-orange-200 dark:bg-orange-800" />
              Crítico (&lt;30 días)
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-yellow-200 dark:bg-yellow-800" />
              Próximo (&lt;90 días)
            </div>
          </div>
        </TabsContent>

        {/* ─── Tab 3: Alertas ─── */}
        <TabsContent value="alertas" className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALERT_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredAlerts.lowStock.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No hay alertas de stock activas</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Sugerencias generadas por el sistema */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowLeftRight size={14} className="text-purple-500" />
                      Sugerencias de Transferencias
                      {displayedSuggestions.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">({displayedSuggestions.length})</span>
                      )}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={refreshSuggestions}
                      disabled={suggestionsLoading}
                    >
                      <RefreshCw size={12} className={suggestionsLoading ? "animate-spin" : ""} />
                      Actualizar
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar medicamento..."
                        value={searchSuggestion}
                        onChange={(e) => { setSearchSuggestion(e.target.value); setSuggestionPage(0); }}
                        className="pl-6 h-7 text-xs w-44"
                      />
                    </div>
                    <Select value={suggestionDeficitHospital} onValueChange={(v) => { setSuggestionDeficitHospital(v); setSuggestionPage(0); }}>
                      <SelectTrigger className="h-7 w-[170px] text-xs">
                        <SelectValue placeholder="Hospital déficit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos (déficit)</SelectItem>
                        {suggestionDeficitHospitals.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={suggestionSurplusHospital} onValueChange={(v) => { setSuggestionSurplusHospital(v); setSuggestionPage(0); }}>
                      <SelectTrigger className="h-7 w-[170px] text-xs">
                        <SelectValue placeholder="Hospital superávit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos (superávit)</SelectItem>
                        {suggestionSurplusHospitals.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(searchSuggestion || suggestionDeficitHospital !== "all" || suggestionSurplusHospital !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground px-2"
                        onClick={() => { setSearchSuggestion(""); setSuggestionDeficitHospital("all"); setSuggestionSurplusHospital("all"); setSuggestionPage(0); }}
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {displayedSuggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {filteredAlerts.suggestions.length === 0
                        ? "No hay sugerencias disponibles — no se detectaron pares déficit / superávit entre hospitales"
                        : "Sin resultados para los filtros aplicados"}
                    </p>
                  ) : (
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Medicamento</TableHead>
                            <TableHead className="text-xs">Hospital con Déficit</TableHead>
                            <TableHead className="text-xs text-right">Faltante</TableHead>
                            <TableHead className="text-xs">Hospital con Superávit</TableHead>
                            <TableHead className="text-xs text-right">Excedente</TableHead>
                            <TableHead className="text-xs text-right">Transferir</TableHead>
                            <TableHead className="text-xs text-right">Ahorro potencial</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedSuggestions.slice(suggestionPage * ITEMS_PER_PAGE, (suggestionPage + 1) * ITEMS_PER_PAGE).map((s, idx) => (
                            <TableRow
                              key={s.medicationId + "::" + s.deficitWorkspace + "::" + idx}
                              className="cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-950/20 group"
                              onClick={() => {
                                setTFormMed(s.medicationId);
                                setTFormFrom(s.surplusWarehouse);
                                setTFormTo(s.deficitWarehouse);
                                setTFormQty(s.suggestedQty);
                                setTransferOpen(true);
                              }}
                            >
                              <TableCell className="text-sm font-medium">{s.medicationName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.deficitWorkspace}</TableCell>
                              <TableCell className="text-right text-sm">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-red-600 font-medium tabular-nums cursor-help">-{s.deficit.toLocaleString("es-AR")}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-56">
                                    Cantidad necesaria para que <strong>{s.deficitWorkspace}</strong> alcance su stock mínimo
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.surplusWorkspace}</TableCell>
                              <TableCell className="text-right text-sm">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-blue-600 font-medium tabular-nums cursor-help">+{s.surplus.toLocaleString("es-AR")}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-60">
                                    Stock disponible de <strong>{s.surplusWorkspace}</strong> por encima de su óptimo (protegido)
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-0 text-[11px] font-semibold tabular-nums cursor-help">
                                      {s.suggestedQty.toLocaleString("es-AR")} u
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-64">
                                    <p>Mínimo entre el faltante de <strong>{s.deficitWorkspace}</strong> ({s.deficit.toLocaleString("es-AR")} uds.) y el excedente de <strong>{s.surplusWorkspace}</strong> ({s.surplus.toLocaleString("es-AR")} uds.).</p>
                                    <p className="mt-1 text-muted-foreground">Por eso puede ser menor al faltante total.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium text-green-700 dark:text-green-400 tabular-nums">
                                ${s.potentialSaving.toLocaleString("es-AR")}
                              </TableCell>
                              <TableCell className="text-right pr-3">
                                <ArrowLeftRight size={13} className="text-muted-foreground/40 group-hover:text-purple-500 transition-colors" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  )}
                  {displayedSuggestions.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-4 py-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {suggestionPage * ITEMS_PER_PAGE + 1}–{Math.min((suggestionPage + 1) * ITEMS_PER_PAGE, displayedSuggestions.length)} de {displayedSuggestions.length}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={suggestionPage === 0}
                          onClick={() => setSuggestionPage((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={(suggestionPage + 1) * ITEMS_PER_PAGE >= displayedSuggestions.length}
                          onClick={() => setSuggestionPage((p) => p + 1)}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de déficits */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown size={14} className="text-red-500" />
                      Medicamentos con Déficit
                      {displayedDeficit.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">({displayedDeficit.length})</span>
                      )}
                    </CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar medicamento..."
                        value={searchDeficit}
                        onChange={(e) => { setSearchDeficit(e.target.value); setDeficitPage(0); }}
                        className="pl-6 h-7 text-xs w-44"
                      />
                    </div>
                    <Select value={deficitHospital} onValueChange={(v) => { setDeficitHospital(v); setDeficitPage(0); }}>
                      <SelectTrigger className="h-7 w-[170px] text-xs">
                        <SelectValue placeholder="Hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los hospitales</SelectItem>
                        {deficitHospitals.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={deficitSeverity} onValueChange={(v) => { setDeficitSeverity(v); setDeficitPage(0); }}>
                      <SelectTrigger className="h-7 w-[150px] text-xs">
                        <SelectValue placeholder="Severidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toda severidad</SelectItem>
                        <SelectItem value="critical">Sin stock (0 u)</SelectItem>
                        <SelectItem value="high">Alto (&gt;50% faltante)</SelectItem>
                        <SelectItem value="moderate">Moderado (≤50%)</SelectItem>
                      </SelectContent>
                    </Select>
                    {(searchDeficit || deficitHospital !== "all" || deficitSeverity !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground px-2"
                        onClick={() => { setSearchDeficit(""); setDeficitHospital("all"); setDeficitSeverity("all"); setDeficitPage(0); }}
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {displayedDeficit.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {lowStock.length === 0 ? "Sin déficits" : "Sin resultados para los filtros aplicados"}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Medicamento</TableHead>
                          <TableHead className="text-xs">Hospital</TableHead>
                          <TableHead className="text-xs text-right">Stock Actual</TableHead>
                          <TableHead className="text-xs text-right">Stock Mínimo</TableHead>
                          <TableHead className="text-xs text-right">Déficit</TableHead>
                          <TableHead className="text-xs">Vence</TableHead>
                          <TableHead className="text-xs">Faltan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedDeficit.slice(deficitPage * ITEMS_PER_PAGE, (deficitPage + 1) * ITEMS_PER_PAGE).map((item, idx) => {
                          const batchKey = item.medicationId + "::" + item.workspaceId;
                          const batchInfo = lowStockBatchInfo.get(batchKey);
                          return (
                            <TableRow key={item.medicationId + "::" + item.workspaceId + "::" + idx}>
                              <TableCell className="text-sm font-medium">{item.medicationName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.workspaceName}</TableCell>
                              <TableCell className="text-right text-sm">{item.currentStock.toLocaleString("es-AR")}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">{item.minStock.toLocaleString("es-AR")}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="destructive" className="text-xs">
                                  -{item.deficit.toLocaleString("es-AR")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {batchInfo?.expiry
                                  ? batchInfo.expiry.toLocaleDateString("es-AR")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {batchInfo?.daysUntil != null
                                  ? batchInfo.daysUntil < 0
                                    ? <span className="text-red-600 font-medium">venció hace {Math.abs(batchInfo.daysUntil)}d</span>
                                    : <span className="text-muted-foreground">en {batchInfo.daysUntil}d</span>
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {displayedDeficit.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-4 py-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {deficitPage * ITEMS_PER_PAGE + 1}–{Math.min((deficitPage + 1) * ITEMS_PER_PAGE, displayedDeficit.length)} de {displayedDeficit.length}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={deficitPage === 0}
                          onClick={() => setDeficitPage((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={(deficitPage + 1) * ITEMS_PER_PAGE >= displayedDeficit.length}
                          onClick={() => setDeficitPage((p) => p + 1)}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 4: Transferencias ─── */}
        <TabsContent value="transferencias" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar transferencia..."
                  value={searchTransfer}
                  onChange={(e) => setSearchTransfer(e.target.value)}
                  className="pl-8 text-sm h-8"
                />
              </div>
              <Select value={transferFilter} onValueChange={setTransferFilter}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-1.5">
              <ArrowLeftRight size={14} /> Nueva Transferencia
            </Button>
          </div>

          {/* Lista de transferencias */}
          <Card>
            <CardContent className="p-0">
              {statusFilteredTransfers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchTransfer ? "Sin resultados" : "No hay transferencias aún"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Medicamento</TableHead>
                      <TableHead className="text-xs">Origen</TableHead>
                      <TableHead className="text-xs">Destino</TableHead>
                      <TableHead className="text-xs text-right">Cant.</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusFilteredTransfers.map((t) => (
                      <TableRow key={t.id} className="text-xs">
                        <TableCell className="font-mono">{t.transfer_code ?? t.id.slice(0, 8)}</TableCell>
                        <TableCell>{medMap.get(t.medication_id) ?? t.medication_id?.slice(0, 8)}</TableCell>
                        <TableCell>{whFullMap.get(t.from_warehouse_id) ?? t.from_warehouse_id?.slice(0, 8)}</TableCell>
                        <TableCell>{whFullMap.get(t.to_warehouse_id) ?? t.to_warehouse_id?.slice(0, 8)}</TableCell>
                        <TableCell className="text-right">{t.quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${TRANSFER_STATUS_COLORS[t.status] ?? ""}`}
                          >
                            {TRANSFER_STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.date ? new Date(t.date).toLocaleDateString("es-AR") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!["aceptado", "rechazado"].includes(t.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleAdvanceTransfer(t.id)}
                                title="Avanzar al siguiente estado"
                              >
                                <ArrowLeftRight size={14} />
                              </Button>
                            )}
                            {t.status === "solicitado" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => handleCancelTransfer(t.id)}
                                title="Cancelar transferencia"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            )}
                            {t.status === "recibido" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => handleRejectTransfer(t.id)}
                                title="Rechazar transferencia"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de nueva transferencia — fuera de los tabs para que sea accesible desde cualquiera */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Transferencia</DialogTitle>
            <DialogDescription className="sr-only">Crear una nueva transferencia de stock entre depósitos</DialogDescription>
          </DialogHeader>
          <TooltipProvider>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Medicamento</Label>
              <select
                value={tFormMed}
                onChange={(e) => setTFormMed(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
              >
                <option value="">Seleccionar...</option>
                {allMeds.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Origen (depósito)</Label>
              <select
                value={tFormFrom}
                onChange={(e) => setTFormFrom(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
              >
                <option value="">Seleccionar...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {whFullMap.get(w.id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Destino (depósito)</Label>
              <select
                value={tFormTo}
                onChange={(e) => setTFormTo(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm mt-1"
              >
                <option value="">Seleccionar...</option>
                {warehouses
                  .filter((w) => w.id !== tFormFrom)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {whFullMap.get(w.id)}
                    </option>
                  ))}
              </select>
              {transferInfo?.to?.deficit != null && transferInfo.to.deficit > 0 && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-semibold text-amber-700 dark:text-amber-400 cursor-help">
                          Déficit de {transferInfo.to.deficit.toLocaleString("es-AR")} unidades
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-60">
                        Déficit total del hospital destino para alcanzar su stock mínimo
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-amber-600 dark:text-amber-500 mt-0.5">
                      Stock actual: {transferInfo.to.currentStock.toLocaleString("es-AR")} · Mínimo requerido: {transferInfo.to.minStock?.toLocaleString("es-AR")}.{" "}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="underline font-medium cursor-help"
                            onClick={() => setTFormQty(transferInfo.to!.deficit!)}
                          >
                            Usar {transferInfo.to.deficit.toLocaleString("es-AR")} u
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64">
                          Completa el déficit total. Verifica que el origen tenga suficiente stock por encima de su óptimo.
                        </TooltipContent>
                      </Tooltip>
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Cantidad</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={tFormQty}
                  onChange={(e) => setTFormQty(Number(e.target.value))}
                  min={1}
                  className="text-sm h-8 mt-1 flex-1"
                />
                {transferInfo?.to?.deficit != null && tFormQty < transferInfo.to.deficit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle size={15} className="text-muted-foreground/60 mt-1 shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-64">
                      <p>Si notás una diferencia entre el nivel óptimo y el que esta IA sugiere, es porque si le das más unidades al hospital destino, el hospital origen caerá por debajo de su nivel óptimo.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            {transferInfo?.from && transferInfo?.to && tFormQty > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Impacto del movimiento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Origen</p>
                    <p className="text-xs font-medium truncate" title={transferInfo.from.hospitalName}>{transferInfo.from.hospitalName}</p>
                    <div className="flex items-center gap-1.5 text-xs tabular-nums">
                      <span>{transferInfo.from.currentStock.toLocaleString("es-AR")}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={`font-semibold ${transferInfo.from.afterTransfer < 0 ? "text-red-600" : "text-foreground"}`}>
                        {transferInfo.from.afterTransfer.toLocaleString("es-AR")}
                      </span>
                    </div>
                    {transferInfo.from.afterTransfer < 0 && (
                      <p className="text-[10px] text-red-600 font-medium">Stock insuficiente</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Destino</p>
                    <p className="text-xs font-medium truncate" title={transferInfo.to.hospitalName}>{transferInfo.to.hospitalName}</p>
                    <div className="flex items-center gap-1.5 text-xs tabular-nums">
                      <span>{transferInfo.to.currentStock.toLocaleString("es-AR")}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={`font-semibold ${
                        transferInfo.to.minStock != null && transferInfo.to.afterTransfer >= transferInfo.to.minStock
                          ? "text-green-600"
                          : "text-amber-600"
                      }`}>
                        {transferInfo.to.afterTransfer.toLocaleString("es-AR")}
                      </span>
                    </div>
                    {transferInfo.to.minStock != null && (
                      <p className="text-[10px] text-muted-foreground">
                        Mín: {transferInfo.to.minStock.toLocaleString("es-AR")} · Ópt: {transferInfo.to.optimalStock?.toLocaleString("es-AR")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateTransfer} disabled={!tFormMed || !tFormFrom || !tFormTo || tFormQty <= 0}>
              Transferir
            </Button>
          </DialogFooter>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}

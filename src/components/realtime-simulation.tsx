import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

type Batch = { id: string; medication_id: string; warehouse_id: string; lot: string; expiry: string; quantity: number };
type Movement = { id: string; type: string; medication_id: string; warehouse_id: string; quantity: number; user_name: string; reason: string; lot?: string; date: string };
type Order = { id: string; medication_id: string; warehouse_id: string; quantity: number; doctor: string; patient: string; room: string; reason: string; status: string; requested_at: string; processed_at?: string; processed_by?: string };
type Transfer = { id: string; transfer_code?: string; medication_id: string; from_warehouse_id: string; to_warehouse_id: string; quantity: number; status: string; requested_by: string; date: string };
type Warehouse = { id: string; name: string; type: string; unit: string; workspace_id: string };
type Medication = { id: string; name: string; concentration_value: number; concentration_unit: string };
type StockConfig = { medication_id: string; warehouse_id: string; min_stock: number; optimal_stock: number };

interface RealtimeData {
  batches: Batch[];
  movements: Movement[];
  orders: Order[];
  transfers: Transfer[];
  warehouses: Warehouse[];
  medications: Medication[];
  stockConfig: StockConfig[];
}

type TrendItem = {
  medication_id: string;
  medication_name: string;
  stock_total: number;
  consumed_per_day: number;
  days_until_empty: number | null;
  risk_category: string;
};

// ── Context ──

type GetDeltaFn = (key: string) => number;
export const DeltaCtx = createContext<GetDeltaFn>(() => 0);
export function useDelta(key: string): number {
  return useContext(DeltaCtx)(key);
}

// ── SimValue component ──

interface SimValueProps {
  value: number;
  delta: number;
  format?: (n: number) => string;
  className?: string;
}

export function SimValue({ value, delta, format = String, className = "" }: SimValueProps) {
  const [visible, setVisible] = useState(false);
  const [displayDelta, setDisplayDelta] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (delta === 0) return;
    setDisplayDelta(delta);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timerRef.current);
  }, [delta]);

  const dir = delta > 0 ? "up" : delta < 0 ? "down" : null;

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span className={`transition-colors duration-500 ${
        dir === "up" ? "text-emerald-600 dark:text-emerald-400" :
        dir === "down" ? "text-red-500 dark:text-red-400" : ""
      }`}>
        {format(value)}
      </span>
      {visible && displayDelta !== 0 && (
        <span className={`ml-1.5 text-xs font-bold animate-fade-out ${
          displayDelta > 0 ? "text-emerald-500" : "text-red-500"
        }`}>
          {displayDelta > 0 ? `+${displayDelta}` : `${displayDelta}`}
        </span>
      )}
    </span>
  );
}

// ── Mock pools ──

const ROOMS = ["101", "102", "201", "202", "301", "Quirófano 1", "Quirófano 2", "UTI", "Pediatría", "Maternidad"];
const PATIENTS = ["Paciente A", "Paciente B", "Paciente C", "Paciente D", "Paciente E", "Paciente F"];

interface MockPools {
  movements: Movement[];
  orders: Order[];
  transfers: Transfer[];
  txDestWarehouseIds: string[];
}

function buildMockPools(data: RealtimeData): MockPools {
  const movTypes = ["ingreso", "venta", "dispensacion", "transferencia", "ajuste"];
  const movements: Movement[] = [];
  for (let i = 0; i < 10; i++) {
    const src = data.movements[i % data.movements.length] ?? data.movements[0];
    movements.push({
      ...src,
      id: `mock-mov-${i}`,
      type: movTypes[i % movTypes.length],
      quantity: (Math.floor(Math.random() * 10) + 1) * 3,
      date: "",
    });
  }

  const orders: Order[] = [];
  for (let i = 0; i < 5; i++) {
    const src = data.orders[i % data.orders.length] ?? data.orders[0];
    orders.push({
      ...src,
      id: `mock-order-${i}`,
      room: ROOMS[i % ROOMS.length],
      patient: PATIENTS[i % PATIENTS.length],
      status: "pendiente",
      requested_at: "",
    });
  }

  const whIds = data.warehouses.map((w) => w.id);
  const transfers: Transfer[] = [];
  for (let i = 0; i < 5; i++) {
    const src = data.transfers[i % data.transfers.length] ?? data.transfers[0];
    const dest = whIds[(i + 1) % whIds.length] ?? whIds[0];
    transfers.push({
      ...src,
      id: `mock-tx-${i}`,
      to_warehouse_id: dest,
      status: "solicitado",
      date: "",
    });
  }

  return { movements, orders, transfers, txDestWarehouseIds: whIds };
}

// ── Metric helpers ──

function computeKeyMetrics(data: RealtimeData, mocks: MockPools): Record<string, number> {
  const consumptionTypes = new Set(["venta", "dispensacion", "transferencia", "ajuste"]);
  const today = new Date().toDateString();
  return {
    "total-units": data.batches.reduce((s, b) => s + b.quantity, 0),
    "total-movements": data.movements.length,
    "ingress-count": data.movements.filter((m) => m.type === "ingreso").length,
    "egress-count": data.movements.filter((m) => consumptionTypes.has(m.type)).length,
    "pending-orders": data.orders.filter((o) => o.status === "pendiente").length,
    "approved-orders": data.orders.filter((o) => o.status === "aprobado").length,
    "rejected-orders": data.orders.filter((o) => o.status === "rechazado").length,
    "active-transfers": data.transfers.filter((t) => !["aceptado", "rechazado"].includes(t.status)).length,
    "to-receive-transfers": data.transfers.filter((t) => ["recibir", "despachado"].includes(t.status)).length,
    "completed-today": data.transfers.filter((t) =>
      ["aceptado", "rechazado"].includes(t.status) && new Date(t.date).toDateString() === today
    ).length,
  };
}

function computeTrendMetrics(trends: TrendItem[]): Record<string, number> {
  const counts: Record<string, number> = { critico: 0, bajo: 0, optimo: 0, superavit: 0 };
  for (const t of trends) {
    if (t.days_until_empty === null) { counts.superavit++; continue; }
    if (t.days_until_empty < 30) counts.critico++;
    else if (t.days_until_empty < 60) counts.bajo++;
    else if (t.days_until_empty < 120) counts.optimo++;
    else counts.superavit++;
  }
  return {
    "trend-critico": counts.critico,
    "trend-bajo": counts.bajo,
    "trend-optimo": counts.optimo,
    "trend-superavit": counts.superavit,
  };
}

// ── Mutation helpers ──

function mutateBatches(arr: Batch[]): Batch[] {
  if (arr.length === 0) return arr;
  const idx = Math.floor(Math.random() * arr.length);
  const change = (Math.floor(Math.random() * 3) + 1) * (Math.random() > 0.5 ? 1 : -1);
  const qty = Math.max(0, arr[idx].quantity + change);
  return arr.map((b, i) => i === idx ? { ...b, quantity: qty } : b);
}

function popMovement(mocks: MockPools, index: number): { movement: Movement; nextIndex: number } {
  const mi = index % mocks.movements.length;
  const src = mocks.movements[mi];
  const mov: Movement = {
    ...src,
    id: `sim-mov-${Date.now()}-${mi}`,
    date: new Date().toISOString(),
    quantity: (Math.floor(Math.random() * 10) + 1) * 3,
  };
  return { movement: mov, nextIndex: index + 1 };
}

const ORDER_FLOW = ["pendiente", "aprobado", "despachado", "recibir", "recibido"];

function mutateOrders(arr: Order[], mocks: MockPools, poolIdx: number): { orders: Order[]; newPoolIdx: number } {
  let result = arr;

  // 50% chance: add a mock order
  if (Math.random() < 0.5 && mocks.orders.length > 0) {
    const oi = poolIdx % mocks.orders.length;
    const src = mocks.orders[oi];
    const newOrder: Order = {
      ...src,
      id: `sim-order-${Date.now()}-${oi}`,
      requested_at: new Date().toISOString(),
    };
    result = [newOrder, ...result];
    poolIdx++;
  }

  // Advance or reject an existing order
  const flowSet = new Set(ORDER_FLOW);
  const idx = arr.findIndex((o) => o.status !== "recibido" && flowSet.has(o.status));
  if (idx !== -1) {
    if (Math.random() < 0.3) {
      result = result.map((o, i) => i === idx ? { ...o, status: "rechazado" } : o);
    } else {
      const next = ORDER_FLOW[ORDER_FLOW.indexOf(arr[idx].status) + 1];
      if (next) {
        result = result.map((o, i) => i === idx ? { ...o, status: next } : o);
      }
    }
  }

  return { orders: result, newPoolIdx: poolIdx };
}

const TX_FLOW = ["solicitado", "autorizado", "despachado", "recibir", "recibido", "aceptado"];

function mutateTransfers(arr: Transfer[], mocks: MockPools, poolIdx: number): { transfers: Transfer[]; newPoolIdx: number } {
  let result = arr;

  // 50% chance: add a mock transfer
  if (Math.random() < 0.5 && mocks.transfers.length > 0) {
    const ti = poolIdx % mocks.transfers.length;
    const src = mocks.transfers[ti];
    const newTx: Transfer = {
      ...src,
      id: `sim-tx-${Date.now()}-${ti}`,
      date: new Date().toISOString(),
      quantity: (Math.floor(Math.random() * 30) + 5),
    };
    result = [newTx, ...result];
    poolIdx++;
  }

  // Advance existing transfer
  const advanceIdx = arr.findIndex((t) =>
    TX_FLOW.includes(t.status) && t.status !== "aceptado" && t.status !== "rechazado"
  );
  if (advanceIdx !== -1) {
    const next = TX_FLOW[TX_FLOW.indexOf(arr[advanceIdx].status) + 1];
    if (next) {
      const isTerminal = next === "aceptado" || next === "rechazado";
      result = result.map((t, i) =>
        i === advanceIdx
          ? { ...t, status: next, ...(isTerminal ? { date: new Date().toISOString() } : {}) }
          : t
      );
    }
  }

  return { transfers: result, newPoolIdx: poolIdx };
}

function computeCategory(days: number | null): string {
  if (days === null) return "superavit";
  if (days < 30) return "critico";
  if (days < 60) return "bajo";
  if (days < 120) return "optimo";
  return "superavit";
}

function mutateTrendItems(arr: TrendItem[]): TrendItem[] {
  if (arr.length === 0) return arr;
  const count = Math.min(5, arr.length);
  let result = arr;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * result.length);
    if (result[idx].days_until_empty === null) continue;
    const change = (Math.floor(Math.random() * 6) + 3) * (Math.random() > 0.5 ? 1 : -1);
    const days = Math.max(0, result[idx].days_until_empty! + change);
    const cat = computeCategory(days);
    result = result.map((t, j) => j === idx ? { ...t, days_until_empty: days, risk_category: cat } : t);
  }
  return result;
}

// ── useSimulation hook ──

export function useSimulation(
  realData: RealtimeData | null,
  realTrends: TrendItem[],
): {
  data: RealtimeData | null;
  trends: TrendItem[];
  getDelta: (key: string) => number;
} {
  const [simData, setSimData] = useState<RealtimeData | null>(null);
  const [simTrends, setSimTrends] = useState<TrendItem[]>([]);
  const deltasRef = useRef<Map<string, { value: number; expiresAt: number }>>(new Map());
  const [, forceTick] = useState(0);
  const initialized = useRef(false);
  const mockPoolsRef = useRef<MockPools>({ movements: [], orders: [], transfers: [], txDestWarehouseIds: [] });
  const poolIdxRef = useRef(0);

  // Initialize once — never reset on subsequent polls
  useEffect(() => {
    if (!realData) {
      initialized.current = false;
      return;
    }
    if (!initialized.current) {
      setSimData(realData);
      setSimTrends(realTrends.map((t) => ({ ...t })));
      mockPoolsRef.current = buildMockPools(realData);
      poolIdxRef.current = 0;
      deltasRef.current.clear();
      initialized.current = true;
      forceTick((n) => n + 1);
    }
  }, [realData, realTrends]);

  // Periodic mutation tick
  useEffect(() => {
    if (!realData) return;

    const tick = () => {
      const mocks = mockPoolsRef.current;
      if (mocks.movements.length === 0) return;

      let ordPoolIdx = poolIdxRef.current;
      let txPoolIdx = poolIdxRef.current;

      setSimData((prev) => {
        if (!prev) return prev;
        const oldMetrics = computeKeyMetrics(prev, mocks);

        // 1. Batches: wiggle quantities
        const newBatches = mutateBatches(prev.batches);

        // 2. Movements: add one from mock pool
        const { movement: newMov, nextIndex: newMovIdx } = popMovement(mocks, poolIdxRef.current);
        poolIdxRef.current = newMovIdx;
        const newMovements = [newMov, ...prev.movements];

        // 3. Orders: add mock + advance/reject
        const { orders: newOrders, newPoolIdx: newOrdPoolIdx } = mutateOrders(prev.orders, mocks, ordPoolIdx);
        ordPoolIdx = newOrdPoolIdx;

        // 4. Transfers: add mock + advance
        const { transfers: newTransfers, newPoolIdx: newTxPoolIdx } = mutateTransfers(prev.transfers, mocks, txPoolIdx);
        txPoolIdx = newTxPoolIdx;

        const newData: RealtimeData = {
          ...prev,
          batches: newBatches,
          movements: newMovements,
          orders: newOrders,
          transfers: newTransfers,
        };

        const newMetrics = computeKeyMetrics(newData, mocks);
        const now = Date.now();
        for (const key of Object.keys(oldMetrics)) {
          const diff = newMetrics[key] - oldMetrics[key];
          if (diff !== 0) deltasRef.current.set(key, { value: diff, expiresAt: now + 2000 });
        }
        return newData;
      });

      setSimTrends((prev) => {
        const oldMetrics = computeTrendMetrics(prev);
        const newTrends = mutateTrendItems(prev);
        const newMetrics = computeTrendMetrics(newTrends);
        const now = Date.now();
        for (const key of Object.keys(oldMetrics)) {
          const diff = newMetrics[key] - oldMetrics[key];
          if (diff !== 0) deltasRef.current.set(key, { value: diff, expiresAt: now + 2000 });
        }
        return newTrends;
      });
    };

    const jitter = Math.random() * 1000;
    const id = setInterval(tick, 2000 + jitter);
    return () => clearInterval(id);
  }, [realData]);

  // Clean expired deltas
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [key, entry] of deltasRef.current) {
        if (entry.expiresAt < now) {
          deltasRef.current.delete(key);
          changed = true;
        }
      }
      if (changed) forceTick((n) => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const getDelta = useCallback((key: string): number => {
    return deltasRef.current.get(key)?.value ?? 0;
  }, []);

  return { data: simData, trends: simTrends, getDelta };
}

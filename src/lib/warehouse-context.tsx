import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Warehouse } from "./domain-types";
import { useStore } from "./store";

interface Ctx {
  warehouse: Warehouse;
  setWarehouse: (w: Warehouse) => void;
  warehouses: Warehouse[];
  warehouseIds: string[];
}

const WarehouseContext = createContext<Ctx | null>(null);
const EMPTY_WAREHOUSE: Warehouse = {
  id: "no-warehouse",
  name: "Sin depósito",
  type: "central",
  unit: "",
  workspaceId: "",
};

const ROLE_ALLOWED_WAREHOUSE_TYPES: Record<string, Warehouse["type"][] | null> = {
  admin: null, // all warehouses
  ventas: ["ventas"],
  tecnico: ["central", "interna"],
  doctor: ["interna"],
};

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const session = useStore((s) => s.session);
  const storeWarehouses = useStore((s) => s.warehouses);
  const users = useStore((s) => s.users);
  const userWarehouseAccesses = useStore((s) => s.userWarehouseAccesses);

  const allWarehouses = storeWarehouses;

  const list = useMemo(() => {
    const byWorkspace = allWarehouses.filter(
      (w) => (!session || w.workspaceId === session.workspaceId) && !w.deletedAt,
    );
    if (!session) return byWorkspace;
    if (session.role === "admin") return byWorkspace;
    const currentUser = users.find((u) => u.email.toLowerCase() === session.email.toLowerCase());
    if (!currentUser) return [];
    const allowedWarehouseIds = new Set(
      userWarehouseAccesses
        .filter((access) => access.userId === currentUser.id)
        .map((access) => access.warehouseId),
    );
    const byAccess = byWorkspace.filter((warehouse) => allowedWarehouseIds.has(warehouse.id));
    const allowedTypes = ROLE_ALLOWED_WAREHOUSE_TYPES[session.role] ?? null;
    return allowedTypes ? byAccess.filter((w) => allowedTypes.includes(w.type)) : byAccess;
  }, [session, allWarehouses, users, userWarehouseAccesses]);

  const [warehouse, setWarehouse] = useState<Warehouse>(list[0] ?? EMPTY_WAREHOUSE);

  useEffect(() => {
    if (!list.find((w) => w.id === warehouse.id)) {
      setWarehouse(list[0] ?? allWarehouses[0] ?? EMPTY_WAREHOUSE);
    }
  }, [list, warehouse.id]);

  return (
    <WarehouseContext.Provider
      value={{ warehouse, setWarehouse, warehouses: list, warehouseIds: list.map((w) => w.id) }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error("useWarehouse must be used inside WarehouseProvider");
  return ctx;
}

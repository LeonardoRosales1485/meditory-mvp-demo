import { redirect } from "@tanstack/react-router";

interface PersistedSession {
  email: string;
  role: "admin" | "ventas" | "doctor" | "tecnico";
  workspaceId: string;
  workspaceName: string;
  name: string;
}

function readSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("meditory-store");
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.state?.session ?? null;
  } catch {
    return null;
  }
}

export function requireAuth() {
  if (typeof window === "undefined") return;
  const session = readSession();
  if (!session) throw redirect({ to: "/login" });
}

export function requireAdmin() {
  if (typeof window === "undefined") return;
  const session = readSession();
  if (!session) throw redirect({ to: "/login" });
  if (session.role !== "admin") throw redirect({ to: "/app" });
}

export function requireAdminOrTecnico() {
  if (typeof window === "undefined") return;
  const session = readSession();
  if (!session) throw redirect({ to: "/login" });
  if (session.role !== "admin" && session.role !== "tecnico") {
    throw redirect({ to: "/app" });
  }
}

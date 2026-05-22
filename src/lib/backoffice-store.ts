import { create } from "zustand";

const SESSION_KEY = "meditory-backoffice";

export interface BackofficeSession {
  id: string;
  email: string;
  name: string;
}

interface State {
  session: BackofficeSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hydrate: () => void;
}

function persist(session: BackofficeSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function readPersisted(): BackofficeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as BackofficeSession) : null;
  } catch {
    return null;
  }
}

export const useBackofficeStore = create<State>()((set) => ({
  session: readPersisted(),
  loading: false,

  hydrate: () => {
    set({ session: readPersisted() });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { backofficeLoginRpc } = await import("./server-rpc");
      const session = await backofficeLoginRpc({ data: { email, password } });
      if (!session) {
        set({ loading: false });
        return false;
      }
      set({ session, loading: false });
      persist(session);
      return true;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    set({ session: null });
    persist(null);
  },
}));

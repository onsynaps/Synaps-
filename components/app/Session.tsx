"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signIn as walletSignIn } from "@/lib/wallet";

type Me = { address: string | null; balance_micros: number; treasury: string; freeDailyLimit: number; markup: number };
type Ctx = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setBalance: (micros: number) => void;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      setMe(await r.json());
    } catch {
      setMe({ address: null, balance_micros: 0, treasury: "", freeDailyLimit: 20, markup: 0.2 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await walletSignIn();
      await refresh();
    } catch (e: any) {
      const msg = e?.code === 4001 ? "You cancelled the signature." : e?.message || "Sign-in failed.";
      setError(msg);
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
  }, [refresh]);

  const setBalance = useCallback((micros: number) => setMe((m) => (m ? { ...m, balance_micros: micros } : m)), []);

  return (
    <SessionCtx.Provider value={{ me, loading, error, refresh, signIn, signOut, setBalance }}>{children}</SessionCtx.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}

"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { robinhoodChain } from "@/lib/chains";
import { signInWith, type Eth } from "@/lib/wallet";

type Me = { address: string | null; balance_micros: number; treasury: string; freeDailyLimit: number; markup: number; isAdmin?: boolean };
type Ctx = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setBalance: (micros: number) => void;
  /** EIP-1193 provider for the signed-in wallet; opens the wallet modal if it is not connected. */
  getProvider: () => Promise<Eth>;
};

const SessionCtx = createContext<Ctx | null>(null);
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmudyp5x100240ck2rd5rvkcd";

function SessionInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const signing = useRef(false);

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

  const doSign = useCallback(async () => {
    if (signing.current) return;
    const w = wallets[0];
    if (!w) return;
    signing.current = true;
    setError(null);
    try {
      const eth = (await w.getEthereumProvider()) as Eth;
      await signInWith(eth, w.address);
      await refresh();
    } catch (e: any) {
      setError(e?.code === 4001 ? "You cancelled the signature." : e?.message || "Sign-in failed.");
    } finally {
      signing.current = false;
    }
  }, [wallets, refresh]);

  // after the Privy modal connects a wallet, finish the Synaps sign-in
  useEffect(() => {
    if (pending.current && authenticated && walletsReady && wallets.length) {
      pending.current = false;
      doSign();
    }
  }, [authenticated, walletsReady, wallets, doSign]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!ready) return;
    if (!authenticated || !wallets.length) {
      pending.current = true;
      login();
      return;
    }
    await doSign();
  }, [ready, authenticated, wallets.length, login, doSign]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await logout(); } catch {}
    await refresh();
  }, [logout, refresh]);

  const getProvider = useCallback(async (): Promise<Eth> => {
    const addr = me?.address?.toLowerCase();
    const w = wallets.find((x) => x.address.toLowerCase() === addr) || null;
    if (!w) {
      if (!authenticated) login();
      throw new Error("Reconnect the wallet you signed in with, then try again.");
    }
    return (await w.getEthereumProvider()) as Eth;
  }, [me?.address, wallets, authenticated, login]);

  const setBalance = useCallback((micros: number) => setMe((m) => (m ? { ...m, balance_micros: micros } : m)), []);

  return (
    <SessionCtx.Provider value={{ me, loading: loading || !ready, error, refresh, signIn, signOut, setBalance, getProvider }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#A594FF",
          logo: "/icon.svg",
          landingHeader: "Connect to Synaps",
          showWalletLoginFirst: true,
        },
        defaultChain: base,
        supportedChains: [base, robinhoodChain],
      }}
    >
      <SessionInner>{children}</SessionInner>
    </PrivyProvider>
  );
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}

"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Logo";
import { XButton } from "@/components/XLink";
import { X_URL, X_HANDLE } from "@/lib/site";
import { useSession } from "./Session";
import { fmtUsd } from "@/lib/money";
import "./app.css";

const NAV = [
  { href: "/app", label: "Chat" },
  { href: "/app/wallet", label: "Wallet" },
  { href: "/app/keys", label: "API keys" },
  { href: "/app/models", label: "Models" },
  { href: "/docs", label: "Docs" },
];

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, loading, signIn, signOut, error } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div className="ap">
      <div className="atmos-glow" aria-hidden="true" />
      <div className="atmos-grain" aria-hidden="true" />
      <header className="ap-top">
        <div className="ap-top-in glass">
          <div className="ap-left">
            <button className="icon-btn ap-menu" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <Brand size={30} href="/" />
            <nav className={"ap-nav" + (open ? " open" : "")} aria-label="App">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className={path === n.href ? "on" : ""} onClick={() => setOpen(false)}>{n.label}</a>
              ))}
              {me?.isAdmin && <a href="/app/admin" className={path === "/app/admin" ? "on" : ""} onClick={() => setOpen(false)}>Admin</a>}
              <a href={X_URL} target="_blank" rel="noreferrer" className="ap-nav-x">X · {X_HANDLE}</a>
            </nav>
          </div>
          <div className="ap-right">
            <XButton className="ap-x" />
            {me?.address ? (
              <>
                <a className="ap-bal" href="/app/wallet" title="Balance">
                  <span className="mono" style={{ fontSize: 10 }}>Balance</span>
                  <span className="num">{fmtUsd(me.balance_micros)}</span>
                </a>
                <a className="btn btn-violet btn-sm" href="/app/wallet">Top up</a>
                <button className="btn btn-ghost btn-sm ap-addr" onClick={signOut} title="Sign out">
                  <span className="ap-dot" aria-hidden="true" />
                  <span className="num">{short(me.address)}</span>
                </button>
              </>
            ) : (
              <button className="btn btn-glow btn-sm" onClick={signIn} disabled={loading}>Connect wallet</button>
            )}
          </div>
        </div>
        {error && <div className="wrap" style={{ marginTop: 10 }}><div className="notice err" role="alert">{error}</div></div>}
      </header>
      <div className="ap-body">{children}</div>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app/Session";
import { fmtUsd } from "@/lib/money";

type Key = { id: string; name: string; prefix: string; daily_limit_micros: number | null; created_at: string; spent_7d_micros: number };

export default function KeysPage() {
  const { me, signIn } = useSession();
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/keys", { cache: "no-store" });
    if (r.ok) setKeys((await r.json()).keys);
  }, []);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (me?.address) load(); }, [me?.address, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, daily_limit_usd: limit ? Number(limit) : null }) });
    const j = await r.json();
    if (!r.ok) return setErr(j?.error?.message || "Could not create the key.");
    setSecret(j.secret);
    setCopied(false);
    setName("");
    setLimit("");
    setKeys((k) => [j.key, ...k]);
  }

  async function revoke(id: string) {
    const r = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (r.ok) setKeys((k) => k.filter((x) => x.id !== id));
    setConfirmId(null);
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  }

  if (!me?.address) {
    return (
      <div className="pg">
        <div className="pg-head"><div><p className="mono">Developers</p><h1>API <span className="serif">keys.</span></h1></div></div>
        <div className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p style={{ margin: 0, color: "var(--muted)", maxWidth: "52ch" }}>Connect your wallet to create API keys. Keys spend the same balance as the chat.</p>
          <button className="btn btn-glow" onClick={signIn}>Connect wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <div className="pg-head">
        <div><p className="mono">Developers</p><h1>API <span className="serif">keys.</span></h1></div>
        <a className="btn btn-ghost btn-sm" href="/docs">Read the docs</a>
      </div>

      <section className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 className="h3" style={{ fontSize: 24 }}>Create a key</h2>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>Base URL <span className="num" style={{ color: "var(--fg)" }}>{origin}/api/v1</span></p>
          </div>
        </div>
        <form onSubmit={create} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "2 1 200px" }}>
            <label className="label" htmlFor="kname">Name</label>
            <input id="kname" className="input" placeholder="my-bot" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label className="label" htmlFor="klimit">Daily limit (USD, optional)</label>
            <input id="klimit" className="input num" inputMode="decimal" placeholder="No limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <button className="btn btn-violet" type="submit">Create key</button>
        </form>
        {err && <div className="notice err" role="alert">{err}</div>}
        {secret && (
          <div className="notice ok" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <strong>Copy your key now. It will not be shown again.</strong>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <code className="num" style={{ wordBreak: "break-all", userSelect: "all", flex: "1 1 260px", color: "var(--fg)" }}>{secret}</code>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => copy(secret)}>{copied ? "Copied" : "Copy"}</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSecret(null)}>Done</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel card-pad">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Key</th><th>Daily limit</th><th className="r">Spent (7d)</th><th><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{k.prefix}••••</td>
                  <td className="num">{k.daily_limit_micros ? fmtUsd(k.daily_limit_micros) + "/day" : "None"}</td>
                  <td className="r num">{fmtUsd(k.spent_7d_micros)}</td>
                  <td className="r">
                    {confirmId === k.id ? (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button className="btn btn-sm" style={{ background: "rgba(255,138,138,.15)", color: "#ffc9c9" }} onClick={() => revoke(k.id)}>Revoke</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(k.id)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && <tr><td colSpan={5} style={{ color: "var(--dim)" }}>No keys yet. Create one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

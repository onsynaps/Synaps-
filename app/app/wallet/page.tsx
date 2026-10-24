"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app/Session";
import { fmtUsd } from "@/lib/money";
import { CHAINS, type ChainKey } from "@/lib/chains";
import { sendTopup } from "@/lib/wallet";
import { InvitePanel } from "@/components/app/InvitePanel";

type Usage = { id: number; source: string; model: string; completion_tokens: number; charged_micros: number; created_at: string };
type Topup = { tx_hash: string; chain: ChainKey; asset: string; usd_micros: number; created_at: string };

type Opt = { chain: ChainKey; asset: "ETH" | "USDC" | "SYNAPS"; label: string; note: string };
const OPTIONS: Opt[] = [
  { chain: "robinhood", asset: "ETH", label: "ETH", note: "Robinhood Chain" },
  { chain: "base", asset: "ETH", label: "ETH", note: "Base" },
  { chain: "base", asset: "USDC", label: "USDC", note: "Base" },
];
const AMOUNTS = [1, 5, 20, 50];

const time = (s: string) => new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function WalletPage() {
  const { me, signIn, refresh, getProvider } = useSession();
  const [opt, setOpt] = useState(0);
  const [synaps, setSynaps] = useState<{ address: string; usd: number; decimals: number; bonus: number; bonus_cap_usd: number } | null>(null);
  useEffect(() => {
    fetch("/api/price", { cache: "no-store" }).then((r) => r.json()).then((j) => setSynaps(j?.synaps ?? null)).catch(() => {});
  }, []);
  const options: Opt[] = synaps
    ? [{ chain: "robinhood", asset: "SYNAPS", label: "$SYNAPS", note: `Robinhood Chain · +${Math.round(synaps.bonus * 100)}% bonus` }, ...OPTIONS]
    : OPTIONS;
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ usage: Usage[]; topups: Topup[]; today: { messages: number; spent_micros: number } } | null>(null);
  const [pending, setPending] = useState<{ hash: string; chain: ChainKey } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/usage", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { if (me?.address) load(); }, [me?.address, load]);

  const usd = custom ? Number(custom) : amount;
  const o = options[Math.min(opt, options.length - 1)];

  async function verify(hash: string, chain: ChainKey) {
    setStatus({ kind: "info", text: "Waiting for the network to confirm your transaction…" });
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch("/api/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash, chain }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        const extras = [j.bonus_micros ? `${fmtUsd(j.bonus_micros)} $SYNAPS bonus` : "", j.referral_micros ? `${fmtUsd(j.referral_micros)} invite bonus` : ""].filter(Boolean);
        setStatus({ kind: "ok", text: `Added ${fmtUsd(j.credited_micros)} to your balance${extras.length ? `, including a ${extras.join(" and a ")}` : ""}.` });
        setPending(null);
        await refresh();
        await load();
        return;
      }
      if (r.status !== 409 || /already/.test(j?.error?.message || "")) {
        setStatus({ kind: "err", text: j?.error?.message || "Could not verify the top-up." });
        if (/already/.test(j?.error?.message || "")) setPending(null);
        return;
      }
      await new Promise((res) => setTimeout(res, 4000));
    }
    setStatus({ kind: "err", text: "Still waiting for confirmation. Your payment is safe; press Check again in a minute." });
  }

  async function topUp() {
    if (!me?.address) return signIn();
    if (!me.treasury) return setStatus({ kind: "err", text: "Top-ups are not open yet." });
    if (!Number.isFinite(usd) || usd < 1) return setStatus({ kind: "err", text: "Enter at least $1." });
    setBusy(true);
    setStatus(null);
    try {
      let ethUsd = 0;
      if (o.asset === "ETH") {
        const p = await fetch("/api/price").then((r) => r.json());
        ethUsd = p.eth_usd;
        if (!ethUsd) throw new Error("Could not load the ETH price. Try again.");
      }
      setStatus({ kind: "info", text: "Confirm the payment in your wallet…" });
      const eth = await getProvider();
      let syn = synaps;
      if (o.asset === "SYNAPS") {
        const p = await fetch("/api/price", { cache: "no-store" }).then((r) => r.json());
        syn = p?.synaps ?? null;
        if (!syn) throw new Error("Could not load the $SYNAPS price. Try again.");
        setSynaps(syn);
      }
      const hash = await sendTopup(eth, { chain: o.chain, asset: o.asset, usd, ethUsd, from: me.address, treasury: me.treasury, synaps: syn ?? undefined });
      setPending({ hash, chain: o.chain });
      await verify(hash, o.chain);
    } catch (e: any) {
      setStatus({ kind: "err", text: e?.code === 4001 ? "You cancelled the payment." : e?.shortMessage || e?.message || "The payment did not go through." });
    } finally {
      setBusy(false);
    }
  }

  if (!me?.address) {
    return (
      <div className="pg">
        <div className="pg-head"><div><p className="mono">Wallet</p><h1>Your <span className="serif">balance.</span></h1></div></div>
        <div className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p style={{ margin: 0, color: "var(--muted)", maxWidth: "52ch" }}>Connect your wallet to see your balance, top up, and view your activity. Signing in costs no gas.</p>
          <button className="btn btn-glow" onClick={signIn}>Connect wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <div className="pg-head"><div><p className="mono">Wallet</p><h1>Your <span className="serif">balance.</span></h1></div></div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        <section className="panel card-pad" style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <span className="label">Balance</span>
          <span className="num" style={{ fontSize: "clamp(44px, 6vw, 64px)", lineHeight: 1, fontWeight: 500 }}>{fmtUsd(me.balance_micros)}</span>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
            <div><dt className="label">Spent today</dt><dd className="num" style={{ margin: "4px 0 0" }}>{fmtUsd(data?.today.spent_micros ?? 0)}</dd></div>
            <div><dt className="label">Messages today</dt><dd className="num" style={{ margin: "4px 0 0" }}>{data?.today.messages ?? 0}</dd></div>
          </dl>
        </section>

        <section className="panel card-pad" style={{ flex: "2 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18, borderColor: "rgba(165,148,255,.3)" }}>
          <h2 className="h3" style={{ fontSize: 24 }}>Top up</h2>
          <div className="field">
            <span className="label">Pay with</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }} role="radiogroup" aria-label="Payment asset">
              {options.map((x, i) => (
                <button key={i} role="radio" aria-checked={opt === i} onClick={() => setOpt(i)} style={{ textAlign: "left", padding: 14, borderRadius: 14, cursor: "pointer", border: `1px solid ${opt === i ? "var(--violet)" : "var(--line)"}`, background: opt === i ? "rgba(165,148,255,.1)" : "#0a0910", color: "var(--fg)", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{x.label}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{x.note}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">Amount (USD)</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {AMOUNTS.map((v) => (
                <button key={v} onClick={() => { setAmount(v); setCustom(""); }} className="num" style={{ minHeight: 46, padding: "0 20px", borderRadius: 12, cursor: "pointer", border: `1px solid ${!custom && amount === v ? "var(--violet)" : "var(--line)"}`, background: !custom && amount === v ? "rgba(165,148,255,.1)" : "#0a0910", color: "var(--fg)" }}>${v}</button>
              ))}
              <label htmlFor="custom" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Custom amount in USD</label>
              <input id="custom" className="input num" inputMode="decimal" placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} style={{ width: 120 }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="label">You get</span>
              <span className="num" style={{ fontSize: 22 }}>{Number.isFinite(usd) && usd > 0 ? `$${(usd + (o.asset === "SYNAPS" && synaps ? Math.min(usd, synaps.bonus_cap_usd) * synaps.bonus : 0)).toFixed(2)} credit` : "—"}</span>
              {o.asset === "SYNAPS" && synaps && Number.isFinite(usd) && usd > 0 && (
                <span style={{ fontSize: 12, color: "var(--violet)" }}>≈ {(usd / synaps.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })} $SYNAPS · includes +{Math.round(synaps.bonus * 100)}% bonus</span>
              )}
              <span style={{ fontSize: 12, color: "var(--dim)" }}>Sent to the Synaps treasury on {CHAINS[o.chain].name}</span>
            </div>
            <button className="btn btn-violet" onClick={topUp} disabled={busy}>{busy ? "Working…" : "Pay in wallet"}</button>
          </div>
          {status && <div className={"notice " + (status.kind === "info" ? "" : status.kind)} role="status">{status.text}</div>}
          {pending && !busy && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => verify(pending.hash, pending.chain)}>Check again</button>
          )}
        </section>
      </div>

      <InvitePanel />

      <section className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h3" style={{ fontSize: 24 }}>Activity</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Time</th><th>Type</th><th>Detail</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {[
                ...(data?.topups ?? []).map((t) => ({ at: t.created_at, type: "Top up", detail: `${t.asset} on ${CHAINS[t.chain]?.name ?? t.chain}`, amount: "+" + fmtUsd(t.usd_micros), color: "var(--cyan)", href: `${CHAINS[t.chain]?.explorer}/tx/${t.tx_hash}` })),
                ...(data?.usage ?? []).map((u) => ({ at: u.created_at, type: u.source === "api" ? "API" : "Chat", detail: `${u.model} · ${u.completion_tokens} tokens`, amount: u.charged_micros ? "−" + fmtUsd(u.charged_micros, 4) : "Free", color: "var(--fg)", href: "" })),
              ]
                .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                .slice(0, 40)
                .map((r, i) => (
                  <tr key={i}>
                    <td className="num" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{time(r.at)}</td>
                    <td>{r.type}</td>
                    <td style={{ color: "var(--muted)" }}>{r.href ? <a href={r.href} target="_blank" rel="noreferrer">{r.detail}</a> : r.detail}</td>
                    <td className="r num" style={{ color: r.color }}>{r.amount}</td>
                  </tr>
                ))}
              {!data?.usage.length && !data?.topups.length && (
                <tr><td colSpan={4} style={{ color: "var(--dim)" }}>No activity yet. Top up, then send your first message.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/app/Session";
import { CHAINS } from "@/lib/chains";

type Day = { day: string; req: number; cost: number; charged: number; topups: number; topup_n: number; free: number; new_users: number };
type Win = { req: number; cost: number; charged: number };
type Data = {
  days: number;
  generated_at: string;
  markup: number;
  lowCreditUsd: number;
  freeDailyLimit: number;
  burnPerDay: number;
  openrouter: { ok: true; total: number | null; used: number | null; remaining: number | null; freeTier: boolean } | { ok: false; error: string };
  treasury: { address: string; ethUsd: number | null; totalUsd: number; rows: { label: string; amount: number | null; usd: number | null }[] } | null;
  alerts: { level: "critical" | "warning" | "info"; title: string; text: string }[];
  stats: {
    users: { total: number; new_24h: number; new_7d: number; active_7d: number; with_balance: number; balances_micros: number };
    topups: { all_micros: number; all_count: number; d1_micros: number; d7_micros: number; d30_micros: number };
    usage: { all: Win; d1: Win; d7: Win; d30: Win; by_source_30d: Record<string, number> };
    free: { today_msgs: number; today_ips: number };
    daily: Day[];
    models_30d: { model: string; req: number; cost: number; charged: number; tokens: number }[];
    spenders_30d: { address: string; req: number; charged: number }[];
    recent_topups: { tx_hash: string; chain: keyof typeof CHAINS; address: string; asset: string; usd_micros: number; created_at: string }[];
  };
};

const usd = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const m2u = (micros: number | null | undefined) => (micros ?? 0) / 1e6;
const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
const n = (v: number) => v.toLocaleString();
const when = (s: string) => new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminPage() {
  const { me, signIn } = useSession();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/stats?days=${days}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 404 ? "This page is only for the Synaps admin wallet." : j?.error?.message || "Could not load stats.");
      setData(j);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { if (me?.isAdmin) load(); }, [me?.isAdmin, load]);
  // refresh every minute while the tab is open
  useEffect(() => {
    if (!me?.isAdmin) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me?.isAdmin, load]);

  if (!me?.address) {
    return (
      <div className="pg">
        <Head />
        <div className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>Connect the admin wallet to see the dashboard.</p>
          <button className="btn btn-glow" onClick={signIn}>Connect wallet</button>
        </div>
      </div>
    );
  }
  if (!me.isAdmin) {
    return (
      <div className="pg">
        <Head />
        <div className="notice err">This page is only for the Synaps admin wallet. You're signed in as {short(me.address)}.</div>
      </div>
    );
  }

  const s = data?.stats;
  const or = data?.openrouter;
  const liability = m2u(s?.users.balances_micros);
  const profit30 = s ? m2u(s.usage.d30.charged - s.usage.d30.cost) : 0;
  const profitAll = s ? m2u(s.usage.all.charged - s.usage.all.cost) : 0;
  const runway = or?.ok && or.remaining != null && data!.burnPerDay > 0 ? or.remaining / data!.burnPerDay : null;

  return (
    <div className="pg adm">
      <div className="pg-head" style={{ alignItems: "flex-end" }}>
        <div><p className="mono">Admin</p><h1>Synaps <span className="serif">at a glance.</span></h1></div>
        <div className="adm-ctrl">
          <div className="seg" role="tablist" aria-label="Range">
            {[7, 30, 90].map((d) => (
              <button key={d} role="tab" aria-selected={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      {err && <div className="notice err" role="alert">{err}</div>}
      {!data && !err && <div className="panel card-pad" style={{ color: "var(--muted)" }}>Loading…</div>}

      {data && s && (
        <>
          {data.alerts.length > 0 && (
            <div className="adm-alerts">
              {data.alerts.map((a, i) => (
                <div key={i} className={"adm-alert lv-" + a.level} role={a.level === "critical" ? "alert" : "status"}>
                  <span className="adm-alert-ic" aria-hidden="true">{a.level === "critical" ? "!" : a.level === "warning" ? "▲" : "i"}</span>
                  <div><strong>{a.title}</strong><p>{a.text}</p></div>
                </div>
              ))}
            </div>
          )}

          {/* Money */}
          <section className="adm-grid">
            <div className="panel card-pad adm-or">
              <div className="adm-row">
                <span className="label">OpenRouter credit left</span>
                <a className="adm-link" href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">Top up ↗</a>
              </div>
              {or?.ok ? (
                <>
                  <span className={"adm-big num" + (or.remaining != null && or.remaining < data.lowCreditUsd ? " bad" : "")}>{usd(or.remaining)}</span>
                  <CreditBar remaining={or.remaining ?? 0} total={or.total ?? 0} liability={liability} />
                  <dl className="adm-dl">
                    <div><dt>Bought in total</dt><dd className="num">{usd(or.total)}</dd></div>
                    <div><dt>Used in total</dt><dd className="num">{usd(or.used)}</dd></div>
                    <div><dt>Spend per day (7d avg)</dt><dd className="num">{usd(data.burnPerDay)}</dd></div>
                    <div><dt>Runway</dt><dd className="num">{runway == null ? "—" : runway > 365 ? "1 year+" : `${runway.toFixed(1)} days`}</dd></div>
                  </dl>
                </>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)" }}>{or?.error}</p>
              )}
            </div>

            <div className="panel card-pad">
              <div className="adm-row"><span className="label">Treasury wallet</span>{data.treasury && <span className="num adm-dim">{short(data.treasury.address)}</span>}</div>
              <span className="adm-big num">{usd(data.treasury?.totalUsd ?? null)}</span>
              <dl className="adm-dl one">
                {data.treasury?.rows.map((r) => (
                  <div key={r.label}><dt>{r.label}</dt><dd className="num">{r.amount == null ? "—" : `${r.amount.toLocaleString(undefined, { maximumFractionDigits: r.label.startsWith("USDC") ? 2 : 5 })} · ${usd(r.usd)}`}</dd></div>
                ))}
              </dl>
              <p className="adm-note">Move funds from here to OpenRouter yourself. Synaps never moves treasury funds.</p>
            </div>

            <div className="panel card-pad">
              <span className="label">User balances (owed)</span>
              <span className="adm-big num">{usd(liability)}</span>
              <dl className="adm-dl one">
                <div><dt>Wallets with credit</dt><dd className="num">{n(s.users.with_balance)}</dd></div>
                <div><dt>Covered by OpenRouter credit</dt><dd className="num">{or?.ok && or.remaining != null ? (or.remaining >= liability ? "Yes" : "No — top up") : "—"}</dd></div>
              </dl>
              <p className="adm-note">Prepaid credit users haven't spent yet. Keep at least this much on OpenRouter.</p>
            </div>
          </section>

          {/* KPIs */}
          <section className="adm-kpis">
            <Kpi label="Top-ups · 24h" value={usd(m2u(s.topups.d1_micros))} sub={`7d ${usd(m2u(s.topups.d7_micros))} · all ${usd(m2u(s.topups.all_micros))}`} />
            <Kpi label="Revenue · 30d" value={usd(m2u(s.usage.d30.charged))} sub={`24h ${usd(m2u(s.usage.d1.charged))}`} />
            <Kpi label="Profit · 30d" value={usd(profit30)} sub={`all time ${usd(profitAll)} · ${Math.round(data.markup * 100)}% fee`} />
            <Kpi label="Paid requests · 30d" value={n(s.usage.d30.req)} sub={`chat ${n(s.usage.by_source_30d.chat ?? 0)} · API ${n(s.usage.by_source_30d.api ?? 0)}`} />
            <Kpi label="Wallets" value={n(s.users.total)} sub={`+${n(s.users.new_24h)} today · ${n(s.users.active_7d)} active 7d`} />
            <Kpi label="Free messages · today" value={n(s.free.today_msgs)} sub={`${n(s.free.today_ips)} visitors · limit ${data.freeDailyLimit}/visitor`} />
          </section>

          {/* Charts */}
          <section className="adm-charts">
            <BarChart title="Revenue per day" unit="usd" data={s.daily.map((d) => ({ day: d.day, v: m2u(d.charged), tip: [`Revenue ${usd(m2u(d.charged), 4)}`, `Provider cost ${usd(m2u(d.cost), 4)}`, `Profit ${usd(m2u(d.charged - d.cost), 4)}`] }))} />
            <BarChart title="Top-ups per day" unit="usd" data={s.daily.map((d) => ({ day: d.day, v: m2u(d.topups), tip: [`${usd(m2u(d.topups))} from ${d.topup_n} top-up${d.topup_n === 1 ? "" : "s"}`] }))} />
            <BarChart title="Messages per day" unit="count" data={s.daily.map((d) => ({ day: d.day, v: d.req + d.free, tip: [`${n(d.req)} paid`, `${n(d.free)} free`, `${n(d.new_users)} new wallet${d.new_users === 1 ? "" : "s"}`] }))} />
          </section>

          {/* Tables */}
          <section className="adm-tables">
            <div className="panel card-pad">
              <h2 className="h3 adm-h">Top models · 30d</h2>
              {s.models_30d.length === 0 ? <Empty text="No paid requests yet." /> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Model</th><th className="r">Requests</th><th className="r">Revenue</th><th className="r">Cost</th><th className="r">Profit</th></tr></thead>
                  <tbody>{s.models_30d.map((m) => (
                    <tr key={m.model}><td className="num" style={{ fontSize: 13 }}>{m.model}</td><td className="r num">{n(m.req)}</td><td className="r num">{usd(m2u(m.charged), 4)}</td><td className="r num adm-dim">{usd(m2u(m.cost), 4)}</td><td className="r num">{usd(m2u(m.charged - m.cost), 4)}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>

            <div className="panel card-pad">
              <h2 className="h3 adm-h">Recent top-ups</h2>
              {s.recent_topups.length === 0 ? <Empty text="No top-ups yet." /> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Time</th><th>Wallet</th><th>Paid with</th><th className="r">Amount</th></tr></thead>
                  <tbody>{s.recent_topups.map((t) => (
                    <tr key={t.tx_hash}>
                      <td className="num adm-dim" style={{ whiteSpace: "nowrap" }}>{when(t.created_at)}</td>
                      <td className="num">{short(t.address)}</td>
                      <td><a className="adm-link" href={`${CHAINS[t.chain]?.explorer}/tx/${t.tx_hash}`} target="_blank" rel="noreferrer">{t.asset} · {CHAINS[t.chain]?.name ?? t.chain} ↗</a></td>
                      <td className="r num">{usd(m2u(t.usd_micros))}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>

            <div className="panel card-pad">
              <h2 className="h3 adm-h">Top spenders · 30d</h2>
              {s.spenders_30d.length === 0 ? <Empty text="No spending yet." /> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Wallet</th><th className="r">Requests</th><th className="r">Spent</th></tr></thead>
                  <tbody>{s.spenders_30d.map((x) => (
                    <tr key={x.address}><td className="num">{short(x.address)}</td><td className="r num">{n(x.req)}</td><td className="r num">{usd(m2u(x.charged), 4)}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </section>

          <p className="adm-note" style={{ textAlign: "right" }}>Updated {when(data.generated_at)} · refreshes every minute · days are UTC</p>
        </>
      )}
    </div>
  );
}

function Head() {
  return <div className="pg-head"><div><p className="mono">Admin</p><h1>Synaps <span className="serif">at a glance.</span></h1></div></div>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel adm-kpi">
      <span className="label">{label}</span>
      <span className="num adm-kpi-v">{value}</span>
      {sub && <span className="adm-kpi-s">{sub}</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ margin: "8px 0 0", color: "var(--dim)", fontSize: 14 }}>{text}</p>;
}

/** Remaining credit vs what users are owed, on one scale. */
function CreditBar({ remaining, total, liability }: { remaining: number; total: number; liability: number }) {
  const max = Math.max(total, liability, remaining, 0.01);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="adm-bar" aria-hidden="true">
      <div className="adm-bar-fill" style={{ width: pct(remaining) }} />
      {liability > 0 && <div className="adm-bar-mark" style={{ left: pct(liability) }} title="User balances" />}
      <div className="adm-bar-legend"><span><i className="sw fill" />Credit left</span>{liability > 0 && <span><i className="sw mark" />User balances</span>}</div>
    </div>
  );
}

type Pt = { day: string; v: number; tip: string[] };
/** Single-series daily bar chart with a hover tooltip and a table fallback. */
function BarChart({ title, data, unit }: { title: string; data: Pt[]; unit: "usd" | "count" }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640, H = 200, padL = 46, padB = 24, padT = 10;
  const max = useMemo(() => {
    const m = Math.max(...data.map((d) => d.v), 0);
    if (m <= 0) return unit === "usd" ? 1 : 10;
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [data, unit]);
  const bw = (W - padL) / data.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const fmt = (v: number) => (unit === "usd" ? (v >= 100 ? "$" + Math.round(v) : "$" + (v < 1 ? v.toFixed(2) : v.toFixed(1))) : n(Math.round(v)));
  const total = data.reduce((a, d) => a + d.v, 0);
  const label = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const every = Math.ceil(data.length / 6);

  return (
    <figure className="panel card-pad adm-chart">
      <figcaption className="adm-row">
        <span><span className="label">{title}</span><span className="num adm-chart-total">{unit === "usd" ? usd(total) : n(total)} <span className="adm-dim">total</span></span></span>
        <button className="adm-link" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>
      </figcaption>
      {table ? (
        <div className="table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}><table className="table" style={{ minWidth: 0 }}>
          <tbody>{[...data].reverse().map((d) => <tr key={d.day}><td className="num adm-dim">{label(d.day)}</td><td className="r num">{fmt(d.v)}</td></tr>)}</tbody>
        </table></div>
      ) : (
        <div className="adm-svg-wrap" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, last ${data.length} days`} preserveAspectRatio="none">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.07)" />
                <text x={padL - 8} y={y(max * f) + 4} textAnchor="end" className="adm-ax">{fmt(max * f)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * bw, h = Math.max(0, H - padB - y(d.v));
              const w = Math.max(2, bw - 2);
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)}>
                  <rect x={x} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
                  {h > 0 && <path d={roundTop(x + 1, H - padB - h, w, h, Math.min(4, w / 2))} fill={hover === i ? "#c9c0ff" : "#a594ff"} opacity={hover == null || hover === i ? 1 : 0.55} />}
                  {i % every === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="adm-ax">{label(d.day)}</text>}
                </g>
              );
            })}
          </svg>
          {hover != null && (
            <div className="adm-tip" style={{ left: `${((padL + (hover + 0.5) * bw) / W) * 100}%` }}>
              <strong>{label(data[hover].day)}</strong>
              {data[hover].tip.map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

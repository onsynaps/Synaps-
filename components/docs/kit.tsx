import { CopyButton } from "./CopyButton";
import { env } from "@/lib/env";

export const BASE = env.siteUrl.replace(/\/$/, "") + "/api/v1";
export const MARKUP_PCT = Math.round(env.markup * 100);
export const FREE_DAILY = env.freeDailyLimit;
export const MIN_BALANCE = (env.minBalanceMicros / 1e6).toFixed(2);
export const TREASURY = env.treasury;

export function Code({ code, lang = "" }: { code: string; lang?: string }) {
  return (
    <div className="dc-code">
      <div className="dc-code-bar">
        <span>{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function Callout({ kind = "note", title, children }: { kind?: "note" | "warn" | "tip"; title?: string; children: React.ReactNode }) {
  return (
    <aside className={"dc-callout dc-" + kind}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </aside>
  );
}

export type Param = { name: string; type: string; required?: boolean; desc: React.ReactNode };

export function Params({ rows }: { rows: Param[] }) {
  return (
    <div className="dc-params">
      {rows.map((r) => (
        <div className="dc-param" key={r.name}>
          <div className="dc-param-head">
            <code>{r.name}</code>
            <span className="dc-type">{r.type}</span>
            {r.required && <span className="dc-req">required</span>}
          </div>
          <div className="dc-param-desc">{r.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function DocTitle({ eyebrow, title, lede }: { eyebrow: string; title: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <header className="dc-title">
      <p className="mono">{eyebrow}</p>
      <h1>{title}</h1>
      {lede && <p className="dc-lede">{lede}</p>}
    </header>
  );
}

export function Pager({ prev, next }: { prev?: { href: string; label: string }; next?: { href: string; label: string } }) {
  return (
    <nav className="dc-pager" aria-label="Pagination">
      {prev ? <a href={prev.href}><span className="mono">Previous</span>{prev.label}</a> : <span />}
      {next ? <a href={next.href} style={{ textAlign: "right" }}><span className="mono">Next</span>{next.label}</a> : <span />}
    </nav>
  );
}

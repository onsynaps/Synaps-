import { Brand } from "@/components/Logo";
import { XButton } from "@/components/XLink";
import "@/components/app/app.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="ap">
      <div className="atmos-glow" aria-hidden="true" />
      <header className="ap-top">
        <div className="ap-top-in glass">
          <div className="ap-left" style={{ paddingLeft: 6 }}><Brand size={30} /></div>
          <div className="ap-right"><XButton /><a className="btn btn-glow btn-sm" href="/app">Launch app</a></div>
        </div>
      </header>
      <main className="ap-body">
        <article className="pg legal" style={{ maxWidth: 760 }}>
          <div className="pg-head"><div><p className="mono">Legal · Updated {updated}</p><h1>{title}</h1></div></div>
          <div className="panel card-pad legal-body">{children}</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--dim)" }}>
            <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/docs">Docs</a>
          </p>
        </article>
      </main>
    </div>
  );
}

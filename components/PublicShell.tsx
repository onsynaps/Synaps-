import { Brand } from "@/components/Logo";
import { XButton } from "@/components/XLink";
import "@/components/app/app.css";

/** Lightweight server-rendered shell for public, indexable pages (no wallet code). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ap">
      <div className="atmos-glow" aria-hidden="true" />
      <header className="ap-top">
        <div className="ap-top-in glass">
          <div className="ap-left" style={{ paddingLeft: 6 }}>
            <Brand size={30} />
            <nav className="pub-nav" aria-label="Site">
              <a href="/models">Models</a>
              <a href="/docs">Docs</a>
            </nav>
          </div>
          <div className="ap-right"><XButton /><a className="btn btn-glow btn-sm" href="/app">Launch app</a></div>
        </div>
      </header>
      <main className="ap-body">{children}</main>
      <footer className="pub-foot">
        <span>© 2026 Synaps</span>
        <a href="/models">Models</a><a href="/docs">Docs</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

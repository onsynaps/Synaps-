import { Brand } from "@/components/Logo";
import { DocsNav } from "@/components/docs/DocsNav";
import "@/components/app/app.css";
import "@/components/docs/docs.css";

export const metadata = { title: { default: "Docs", template: "%s · Synaps Docs" } };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ap">
      <div className="atmos-glow" aria-hidden="true" />
      <header className="ap-top">
        <div className="ap-top-in glass">
          <div className="ap-left" style={{ paddingLeft: 6, gap: 14 }}>
            <Brand size={30} />
            <span className="mono dc-badge">Docs</span>
          </div>
          <div className="ap-right">
            <a className="btn btn-ghost btn-sm" href="/app/models">Models</a>
            <a className="btn btn-glow btn-sm" href="/app/keys">Get API key</a>
          </div>
        </div>
      </header>
      <div className="ap-body">
        <div className="dc">
          <DocsNav />
          <main className="dc-main">{children}</main>
        </div>
      </div>
    </div>
  );
}

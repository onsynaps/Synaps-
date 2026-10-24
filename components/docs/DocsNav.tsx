"use client";
import { usePathname } from "next/navigation";

export const DOCS_NAV = [
  { group: "Getting started", items: [
    { href: "/docs", label: "Overview" },
    { href: "/docs/quickstart", label: "Quickstart" },
    { href: "/docs/authentication", label: "Authentication" },
  ] },
  { group: "API reference", items: [
    { href: "/docs/chat-completions", label: "Chat completions" },
    { href: "/docs/streaming", label: "Streaming" },
    { href: "/docs/tools", label: "Tool calling & JSON" },
    { href: "/docs/models", label: "Models" },
  ] },
  { group: "Account", items: [
    { href: "/docs/billing", label: "Billing & pricing" },
    { href: "/docs/top-ups", label: "Top-ups" },
    { href: "/docs/rate-limits", label: "Rate limits" },
    { href: "/docs/errors", label: "Errors" },
    { href: "/docs/privacy", label: "Privacy lanes" },
  ] },
  { group: "Guides", items: [
    { href: "/docs/integrations", label: "Integrations" },
    { href: "/docs/faq", label: "FAQ" },
  ] },
];

export function DocsNav() {
  const path = usePathname();
  const flat = DOCS_NAV.flatMap((g) => g.items);
  return (
    <>
      <label className="dc-mobile-nav">
        <span className="mono">On this site</span>
        <select value={path} onChange={(e) => (window.location.href = e.target.value)} className="select">
          {DOCS_NAV.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => <option key={i.href} value={i.href}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <nav className="dc-side" aria-label="Docs">
        {DOCS_NAV.map((g) => (
          <div key={g.group} className="dc-side-group">
            <p className="mono">{g.group}</p>
            {g.items.map((i) => (
              <a key={i.href} href={i.href} className={path === i.href ? "on" : ""} aria-current={path === i.href ? "page" : undefined}>{i.label}</a>
            ))}
          </div>
        ))}
        <p className="dc-side-foot">{flat.length} pages · API v1</p>
      </nav>
    </>
  );
}

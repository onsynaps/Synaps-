import type { Metadata } from "next";
import { getModels, type Model } from "@/lib/models";
import { SITE, modelPath, ctxLabel, per1M, money } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "AI models you can pay for with crypto — Claude, GPT, Gemini, DeepSeek",
  description:
    "Every model on Synaps with live per-token prices: Claude, GPT, Gemini, Grok, DeepSeek, Qwen, Kimi, Mistral, Llama and free models. Pay per message with ETH or USDC. OpenAI-compatible API.",
  alternates: { canonical: "/models" },
  openGraph: { title: "AI models on Synaps", description: "Live prices for Claude, GPT, Gemini, DeepSeek and more. Pay per message with crypto.", url: SITE + "/models" },
};

export default async function ModelsIndex() {
  let models: Model[] = [];
  try { models = await getModels(); } catch {}

  const groups: Record<string, Model[]> = {};
  for (const m of models) (groups[m.free ? "Free models" : m.outputs.includes("image") ? "Image generation" : m.maker] ||= []).push(m);
  const order = Object.keys(groups).sort((a, b) => (a === "Free models" ? 1 : b === "Free models" ? -1 : a === "Image generation" ? 1 : b === "Image generation" ? -1 : a.localeCompare(b)));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "AI models on Synaps",
    itemListElement: models.slice(0, 100).map((m, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + modelPath(m.id), name: m.name })),
  };

  return (
    <div className="pg" style={{ maxWidth: 1120 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pg-head">
        <div>
          <p className="mono">{models.length} models · live prices</p>
          <h1>Every AI model, <span className="serif">pay as you go.</span></h1>
        </div>
        <a className="btn btn-glow btn-sm" href="/app">Open chat</a>
      </div>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "68ch", fontSize: 17 }}>
        Use Claude, GPT, Gemini, Grok, DeepSeek, Qwen and more from one balance — in the chat or through one OpenAI-compatible API key.
        Top up with ETH or USDC, no subscription and no card. Prices below are per million tokens and already include the {""}
        Synaps fee.
      </p>

      {order.map((g) => (
        <section key={g} className="panel card-pad" aria-labelledby={"g-" + g.replace(/\W+/g, "-")}>
          <h2 id={"g-" + g.replace(/\W+/g, "-")} className="h3" style={{ fontSize: 22, margin: "0 0 10px" }}>{g}</h2>
          <div className="mdl-grid">
            {groups[g].map((m) => (
              <a key={m.id} className="mdl-card" href={modelPath(m.id)}>
                <span className="mdl-name">{m.name}</span>
                <span className="mdl-id num">{m.id}</span>
                <span className="mdl-meta num">
                  {m.free ? "Free" : `${money(per1M(m.promptPrice))} in · ${money(per1M(m.completionPrice))} out`} · {ctxLabel(m.context)} ctx
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
      {models.length === 0 && <div className="notice err">Could not load the model list right now. Refresh in a minute.</div>}
    </div>
  );
}

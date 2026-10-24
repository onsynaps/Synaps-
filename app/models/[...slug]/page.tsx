import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModels, type Model } from "@/lib/models";
import { env } from "@/lib/env";
import { SITE, modelPath, idFromSlug, ctxLabel, per1M, money, caps } from "@/lib/seo";
import { CopyButton } from "@/components/docs/CopyButton";

export const revalidate = 600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string[] }> };

const LANE = {
  free: { label: "Free", text: "Free models are offered by providers who may log prompts to keep them free. Don't send anything sensitive." },
  private: { label: "No training", text: "Synaps routes this model only to providers that don't store or train on your prompts." },
  provider: { label: "Provider can read", text: "This model's maker runs it and can read requests under its own policy. Synaps doesn't store your prompts." },
} as const;

async function find(slug: string[]): Promise<{ m: Model; all: Model[] } | null> {
  const id = idFromSlug(slug);
  const all = await getModels().catch(() => [] as Model[]);
  const m = all.find((x) => x.id === id);
  return m ? { m, all } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await find(slug);
  if (!r) return { title: "Model not found", robots: { index: false } };
  const { m } = r;
  const price = m.free ? "free" : `${money(per1M(m.promptPrice))} input / ${money(per1M(m.completionPrice))} output per 1M tokens`;
  const title = `${m.name} API — pay per message with crypto`;
  const description = `Use ${m.name} by ${m.maker} in chat or through an OpenAI-compatible API. ${m.free ? "Free to try, no wallet needed." : `Priced at ${price}.`} Top up with ETH or USDC on Robinhood Chain or Base. No subscription.`;
  return {
    title,
    description,
    alternates: { canonical: modelPath(m.id) },
    openGraph: { title: `${m.name} on Synaps`, description, url: SITE + modelPath(m.id) },
    twitter: { title: `${m.name} on Synaps`, description },
  };
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const r = await find(slug);
  if (!r) notFound();
  const { m, all } = r;

  const inM = per1M(m.promptPrice), outM = per1M(m.completionPrice);
  const listInM = per1M(m.listPromptPrice), listOutM = per1M(m.listCompletionPrice);
  // a typical chat turn: ~1,500 tokens in, ~500 out
  const perMsg = m.promptPrice * 1500 + m.completionPrice * 500;
  const fee = Math.round(env.markup * 100);
  const apiBase = SITE + "/api/v1";
  const related = all.filter((x) => x.id !== m.id && x.maker === m.maker).slice(0, 6);
  const capList = caps(m);

  const curl = `curl ${apiBase}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${m.id}",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`;
  const py = `from openai import OpenAI

client = OpenAI(base_url="${apiBase}", api_key="syn_...")

reply = client.chat.completions.create(
    model="${m.id}",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(reply.choices[0].message.content)`;

  const faq = [
    {
      q: `How much does ${m.name} cost on Synaps?`,
      a: m.free
        ? `${m.name} is free on Synaps, up to ${env.freeDailyLimit} messages a day in the chat without a wallet.`
        : `${money(inM)} per million input tokens and ${money(outM)} per million output tokens, including the ${fee}% Synaps fee. A typical chat message costs about ${money(perMsg)}. You only pay for what you use.`,
    },
    {
      q: `Can I pay for ${m.name} with crypto?`,
      a: `Yes. Top up your Synaps balance with ETH on Robinhood Chain or Base, or USDC on Base, from $1. Each message is deducted from that balance. There is no subscription or card.`,
    },
    {
      q: `Is there a ${m.name} API?`,
      a: `Yes. Create an API key on Synaps and call ${m.id} through the OpenAI-compatible endpoint ${apiBase}/chat/completions. Any OpenAI SDK works by changing the base URL.`,
    },
    {
      q: `What can ${m.name} do?`,
      a: `It accepts ${m.inputs.join(", ")} and produces ${m.outputs.join(" and ")}, with a context window of ${ctxLabel(m.context)} tokens.${m.inputs.includes("image") ? " You can attach photos in the chat." : ""}${m.outputs.includes("image") ? " Turn on Image mode in the chat to generate pictures." : ""}`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Synaps", item: SITE },
        { "@type": "ListItem", position: 2, name: "Models", item: SITE + "/models" },
        { "@type": "ListItem", position: 3, name: m.name, item: SITE + modelPath(m.id) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <article className="pg" style={{ maxWidth: 1000 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="crumbs" aria-label="Breadcrumb"><a href="/models">Models</a><span aria-hidden="true">/</span><span>{m.maker}</span></nav>

      <div className="pg-head">
        <div>
          <p className="mono">{m.maker} · {ctxLabel(m.context)} context</p>
          <h1>{m.name} <span className="serif">API</span></h1>
        </div>
        <a className="btn btn-glow" href={`/app?model=${encodeURIComponent(m.id)}`}>Chat with {m.name}</a>
      </div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 17, maxWidth: "66ch" }}>
        Use {m.name} in the Synaps chat or through one OpenAI-compatible API key. {m.free ? "It's free to try without a wallet." : "Pay per message from a balance you top up with ETH or USDC."} No subscription, no card.
      </p>

      <div className="mdl-chips">
        <span className={"chip lane-" + m.lane}>{LANE[m.lane].label}</span>
        {capList.map((c) => <span key={c} className="chip cap">{c}</span>)}
      </div>

      <section className="mdl-stats">
        <div className="panel mdl-stat"><span className="label">Input / 1M tokens</span><span className="num">{money(inM)}</span>{!m.free && <span className="mdl-sub">list {money(listInM)}</span>}</div>
        <div className="panel mdl-stat"><span className="label">Output / 1M tokens</span><span className="num">{money(outM)}</span>{!m.free && <span className="mdl-sub">list {money(listOutM)}</span>}</div>
        <div className="panel mdl-stat"><span className="label">Typical message</span><span className="num">{m.free ? "Free" : "≈ " + money(perMsg)}</span><span className="mdl-sub">1.5K in · 500 out</span></div>
        <div className="panel mdl-stat"><span className="label">Context window</span><span className="num">{ctxLabel(m.context)}</span><span className="mdl-sub">tokens</span></div>
      </section>
      {!m.free && <p className="mdl-note">Prices include the {fee}% Synaps fee and update automatically. &ldquo;List&rdquo; is what the provider charges.{m.imagePrice ? ` Images are billed at about ${money(m.imagePrice)} each.` : ""}</p>}

      <section className="panel card-pad">
        <h2 className="h3 mdl-h">Call {m.name} from code</h2>
        <p style={{ margin: "0 0 14px", color: "var(--muted)" }}>Synaps speaks the OpenAI Chat Completions format. Point any OpenAI SDK at Synaps and set <code>model</code> to <code>{m.id}</code>.</p>
        <div className="mdl-code"><div className="mdl-code-bar"><span className="mono">cURL</span><CopyButton text={curl} /></div><pre>{curl}</pre></div>
        <div className="mdl-code"><div className="mdl-code-bar"><span className="mono">Python</span><CopyButton text={py} /></div><pre>{py}</pre></div>
        <p style={{ margin: "12px 0 0", fontSize: 14 }}><a className="adm-link" href="/docs/quickstart">Quickstart</a> · <a className="adm-link" href="/docs/chat-completions">API reference</a> · <a className="adm-link" href="/app/keys">Create an API key</a></p>
      </section>

      <section className="panel card-pad">
        <h2 className="h3 mdl-h">Privacy</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>{LANE[m.lane].text}</p>
      </section>

      <section className="panel card-pad">
        <h2 className="h3 mdl-h">Questions</h2>
        {faq.map((f) => (
          <div key={f.q} className="mdl-faq"><h3>{f.q}</h3><p>{f.a}</p></div>
        ))}
      </section>

      {related.length > 0 && (
        <section className="panel card-pad">
          <h2 className="h3 mdl-h">More from {m.maker}</h2>
          <div className="mdl-grid">
            {related.map((x) => (
              <a key={x.id} className="mdl-card" href={modelPath(x.id)}>
                <span className="mdl-name">{x.name}</span>
                <span className="mdl-meta num">{x.free ? "Free" : `${money(per1M(x.promptPrice))} in · ${money(per1M(x.completionPrice))} out`}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <p style={{ margin: 0 }}><a className="adm-link" href="/models">← All models</a></p>
    </article>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SITE, ogCard } from "@/lib/seo";
import type { StoredMsg } from "@/lib/chat-shape";
import { PublicShell } from "@/components/PublicShell";
import { Markdown } from "@/components/app/Markdown";
import { OrbitMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };
type Share = { id: string; title: string; model: string; messages: StoredMsg[]; created_at: string };

async function load(id: string): Promise<Share | null> {
  if (!/^[a-zA-Z0-9]{6,16}$/.test(id)) return null;
  const { data } = await db().from("syn_shares").select("id,title,model,messages,created_at").eq("id", id).maybeSingle();
  return (data as Share) ?? null;
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await load(id);
  if (!s) return { title: "Chat not found", robots: { index: false } };
  const first = s.messages.find((m) => m.role === "assistant")?.content ?? "";
  const card = ogCard(s.model ? `Shared chat · ${s.model.split("/").pop()}` : "Shared chat", s.title || "Shared chat");
  const description = first.replace(/[#*_`>\[\]()]/g, "").replace(/\s+/g, " ").slice(0, 160);
  return {
    title: s.title || "Shared chat",
    description,
    robots: { index: false, follow: true }, // people's chats stay out of search results
    alternates: { canonical: `/s/${s.id}` },
    openGraph: { title: `${s.title || "Shared chat"} · Synaps`, description, url: `${SITE}/s/${s.id}`, type: "article", images: [card] },
    twitter: { card: "summary_large_image", title: `${s.title || "Shared chat"} · Synaps`, description, images: [card.url] },
  };
}

export default async function SharedChat({ params }: Props) {
  const { id } = await params;
  const s = await load(id);
  if (!s) notFound();
  db().rpc("syn_share_view", { p_id: s.id }).then(() => null, () => null);

  const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <PublicShell>
      <article className="pg shr" style={{ maxWidth: 820 }}>
        <div className="pg-head">
          <div>
            <p className="mono">Shared chat · {date}</p>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>{s.title || "Shared chat"}</h1>
          </div>
        </div>
        <div className="panel card-pad shr-body">
          {s.messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg-u-wrap">
                {m.attachments?.length ? (
                  <div className="att-row att-row-sent">
                    {m.attachments.map((a, k) => (
                      <span key={k} className="att-chip"><span className={"file-glyph fg-" + a.kind} aria-hidden="true">{a.kind === "pdf" ? "PDF" : a.kind === "text" ? "TXT" : "IMG"}</span><span className="att-name">{a.name}</span></span>
                    ))}
                  </div>
                ) : null}
                {m.content && <div className="msg-u">{m.content}</div>}
              </div>
            ) : (
              <div key={i} className="msg-a">
                <span className="av" aria-hidden="true"><OrbitMark size={30} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {m.modelName && <div className="msg-model">{m.modelName}</div>}
                  {m.hadImages ? <p className="gen-gone">{m.hadImages} generated image{m.hadImages > 1 ? "s" : ""} (not included in shared chats)</p> : null}
                  <div className="body">{m.content ? <Markdown text={m.content} /> : null}</div>
                  {m.sources?.length ? (
                    <div className="srcs">
                      <span className="mono">Sources</span>
                      {m.sources.map((src, k) => (
                        <a key={k} className="src" href={src.url} target="_blank" rel="noreferrer nofollow ugc"><span className="src-n num">{k + 1}</span>{src.title ? src.title.slice(0, 60) : host(src.url)}<span className="src-h">{host(src.url)}</span></a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}
        </div>
        <div className="panel card-pad shr-cta">
          <div>
            <strong>Made with Synaps</strong>
            <p>Chat with Claude, GPT, Gemini and more. Pay per message with crypto — free models need no wallet.</p>
          </div>
          <a className="btn btn-glow" href={`/app?model=${encodeURIComponent(s.model)}`}>Try it free</a>
        </div>
        <p className="mdl-note" style={{ margin: 0 }}>This chat was shared by a Synaps user. Synaps doesn&apos;t review shared chats; AI answers can be wrong.</p>
      </article>
    </PublicShell>
  );
}

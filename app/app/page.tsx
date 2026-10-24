"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/app/Session";
import { fmtUsd, perMillion } from "@/lib/money";
import type { Model } from "@/lib/models";
import { Markdown } from "@/components/app/Markdown";
import { OrbitMark } from "@/components/Logo";
import { ACCEPT, MAX_FILES, readAttachment, fmtSize, type Attachment } from "@/lib/attachments";

type Msg = {
  role: "user" | "assistant";
  content: string;
  charged?: number;
  tokens?: number;
  error?: boolean;
  modelName?: string;
  attachments?: Attachment[];
  images?: string[]; // generated images (data URLs); not saved to history
};
type Convo = { id: string; title: string; model: string; messages: Msg[]; at: number };
type Warn = { text: string; suggest?: Model };

const STORE = "synaps.chats.v1";
const LANE = { free: "Free", private: "No training", provider: "Provider can read" } as const;
const LANE_NOTE = {
  free: "Free model: the provider may log prompts to offer it at no cost.",
  private: "Routed only to providers that do not store or train on your prompts.",
  provider: "This model's maker can read this chat under their own policy.",
} as const;
const SUGGEST = ["Explain bonding curves in two sentences", "Write a launch tweet for a new token", "Review this Solidity function for bugs", "Translate “gm, frens” into Korean"];
const MAX_BODY = 4 * 1024 * 1024;

const sees = (m?: Model) => !!m?.inputs?.includes("image");
const draws = (m?: Model) => !!m?.outputs?.includes("image");

function load(): Convo[] {
  try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; }
}
/** Saves history without large attachment data or generated images, which would overflow browser storage. */
function save(c: Convo[]) {
  const slim = c.slice(0, 50).map((cv) => ({
    ...cv,
    messages: cv.messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map(({ data, text, ...rest }) => rest),
      images: m.images?.length ? [] : undefined,
      content: m.images?.length && !m.content ? "[Generated image — download it before you leave the page; images are not saved in history.]" : m.content,
    })),
  }));
  try { localStorage.setItem(STORE, JSON.stringify(slim)); } catch {}
}
const uid = () => Math.random().toString(36).slice(2, 10);

/** Builds the API message: text, inlined text files, images and PDFs as content parts. */
function toApi(m: Msg): { role: string; content: any } {
  if (m.role === "assistant" || !m.attachments?.length) return { role: m.role, content: m.content || " " };
  let text = m.content;
  const parts: any[] = [];
  for (const a of m.attachments) {
    if (a.kind === "text") text += a.text ? `\n\n--- File: ${a.name} ---\n${a.text}` : `\n\n[File ${a.name} is no longer available]`;
    else if (a.kind === "image") {
      if (a.data) parts.push({ type: "image_url", image_url: { url: a.data } });
      else text += `\n\n[Image ${a.name} is no longer available]`;
    } else if (a.kind === "pdf") {
      if (a.data) parts.push({ type: "file", file: { filename: a.name, file_data: a.data } });
      else text += `\n\n[PDF ${a.name} is no longer available]`;
    }
  }
  return { role: "user", content: [{ type: "text", text: text || " " }, ...parts] };
}

export default function ChatPage() {
  const { me, signIn, setBalance } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<Warn | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setConvos(load());
    fetch("/api/models").then((r) => r.json()).then((j) => {
      const list: Model[] = (j.models || []).map((m: Model) => ({ ...m, inputs: m.inputs || ["text"], outputs: m.outputs || ["text"] }));
      setModels(list);
      const def = list.find((m) => m.free && /gpt-oss/.test(m.id)) || list.find((m) => m.free && !draws(m)) || list[0];
      if (def) setModelId((cur) => cur || def.id);
    }).catch(() => setErr("Could not load models. Refresh to try again."));
  }, []);

  const model = models.find((m) => m.id === modelId);
  const active = convos.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.images?.length]);
  useEffect(() => { setWarn(null); }, [modelId, imageMode, files.length]);

  const grouped = useMemo(() => {
    const g: Record<string, Model[]> = {};
    for (const m of models) (g[m.free ? "Free" : draws(m) ? "Image generation" : m.maker] ||= []).push(m);
    return g;
  }, [models]);

  function update(id: string, fn: (c: Convo) => Convo) {
    setConvos((cs) => {
      const next = cs.map((c) => (c.id === id ? fn(c) : c));
      save(next);
      return next;
    });
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const arr = Array.from(list);
    if (!arr.length) return;
    setErr(null);
    setReading(true);
    try {
      const room = MAX_FILES - files.length;
      if (arr.length > room) setErr(`You can attach up to ${MAX_FILES} files per message.`);
      const read: Attachment[] = [];
      for (const f of arr.slice(0, Math.max(0, room))) {
        try { read.push(await readAttachment(f)); } catch (e: any) { setErr(e?.message || "Could not read that file."); }
      }
      setFiles((cur) => [...cur, ...read].slice(0, MAX_FILES));
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** Picks a model that can do what the message needs, preferring ones the person can use right now. */
  function suggestFor(need: (m: Model) => boolean): Model | undefined {
    const ok = models.filter(need);
    const usable = me?.address ? ok : ok.filter((m) => m.free);
    const pool = usable.length ? usable : ok;
    return [...pool].sort((a, b) => a.completionPrice - b.completionPrice)[0];
  }

  async function send(text: string, opts?: { forceModel?: Model }) {
    const mdl = opts?.forceModel ?? model;
    const content = text.trim();
    if ((!content && !files.length) || busy || reading || !mdl) return;
    setErr(null);
    setWarn(null);

    // capability checks happen on send, so the tools are always visible
    const historyHasImages = messages.some((m) => m.attachments?.some((a) => a.kind === "image" && a.data));
    const needsVision = files.some((f) => f.kind === "image") || historyHasImages;
    if (needsVision && !sees(mdl)) {
      const s = suggestFor((m) => sees(m) && (!imageMode || draws(m)));
      setWarn({ text: `${mdl.name} can't read images.${s ? ` Switch to ${s.name}, which can.` : " Pick a model that can see images."}`, suggest: s });
      return;
    }
    if (imageMode && !draws(mdl)) {
      const s = suggestFor((m) => draws(m) && (!needsVision || sees(m)));
      setWarn({ text: `${mdl.name} can't create images.${s ? ` Switch to ${s.name} to generate one.` : " Pick an image model."}`, suggest: s });
      return;
    }
    if (!mdl.free && !me?.address) { await signIn(); return; }
    if (imageMode && !content) { setErr("Describe the image you want."); return; }

    let id = activeId;
    let history: Msg[] = messages;
    if (!active) {
      id = uid();
      const title = (content || files[0]?.name || "New chat").slice(0, 60);
      const c: Convo = { id, title, model: mdl.id, messages: [], at: Date.now() };
      setConvos((cs) => { const n = [c, ...cs]; save(n); return n; });
      setActiveId(id);
      history = [];
    }
    const userMsg: Msg = { role: "user", content, attachments: files.length ? files : undefined };
    const outgoing: Msg[] = [...history, userMsg];
    const payload = JSON.stringify({ model: mdl.id, mode: imageMode ? "image" : "chat", messages: outgoing.map(toApi) });
    if (payload.length > MAX_BODY) {
      setErr("These attachments are too large to send together. Remove some files or start a new chat.");
      return;
    }

    update(id, (c) => ({ ...c, model: mdl.id, messages: [...outgoing, { role: "assistant", content: "", modelName: mdl.name }] }));
    setInput("");
    setFiles([]);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    const patchLast = (p: Partial<Msg>) =>
      update(id, (c) => {
        const ms = [...c.messages];
        ms[ms.length - 1] = { ...ms[ms.length - 1], ...p };
        return { ...c, messages: ms };
      });

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: ac.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Something went wrong. Try again.");
      }

      if (imageMode) {
        const j = await res.json();
        const msg = j?.choices?.[0]?.message ?? {};
        const imgs: string[] = (msg.images ?? []).map((x: any) => x?.image_url?.url).filter((u: any) => typeof u === "string");
        if (j.synaps && typeof j.synaps.balance_micros === "number") setBalance(j.synaps.balance_micros);
        if (!imgs.length && !msg.content) throw new Error("The model didn't return an image. Try a clearer prompt or another image model.");
        patchLast({ content: typeof msg.content === "string" ? msg.content : "", images: imgs, charged: j.synaps?.charged_micros ?? 0, tokens: j.synaps?.completion_tokens ?? 0 });
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let j: any;
          try { j = JSON.parse(data); } catch { continue; }
          if (j.synaps) {
            if (typeof j.synaps.balance_micros === "number") setBalance(j.synaps.balance_micros);
            patchLast({ charged: j.synaps.charged_micros, tokens: j.synaps.completion_tokens });
            continue;
          }
          if (j.error) throw new Error(j.error.message || "The model stopped with an error.");
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            acc += delta;
            patchLast({ content: acc });
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErr(e?.message || "Something went wrong.");
        update(id, (c) => {
          const ms = [...c.messages];
          const last = ms[ms.length - 1];
          if (last?.role === "assistant" && !last.content && !last.images?.length) ms.pop();
          return { ...c, messages: ms };
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function newChat() { setActiveId(""); setErr(null); setWarn(null); setSideOpen(false); }
  function remove(id: string) {
    setConvos((cs) => { const n = cs.filter((c) => c.id !== id); save(n); return n; });
    if (id === activeId) setActiveId("");
  }

  const estimate = !model ? "" : imageMode && !draws(model) ? "" : model.free ? "Free" : imageMode && draws(model)
    ? (model.imagePrice ? "≈ " + fmtUsd(Math.ceil(model.imagePrice * 1e6), 3) + " per image" : "Priced per image")
    : "≈ " + fmtUsd(Math.ceil(model.completionPrice * 800 * 1e6), 4) + " per reply";

  return (
    <div className="ch">
      <aside className={"ch-side panel" + (sideOpen ? " open" : "")} aria-label="Chats">
        <button className="btn btn-ghost" onClick={newChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New chat
        </button>
        <div className="ch-hist">
          {convos.length === 0 && <p style={{ color: "var(--dim)", fontSize: 13, padding: "8px 12px", margin: 0 }}>Your chats appear here. They are saved in this browser only.</p>}
          {convos.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
              <button className={c.id === activeId ? "on" : ""} style={{ flex: 1, minWidth: 0 }} onClick={() => { setActiveId(c.id); setModelId(c.model); setSideOpen(false); }}>{c.title}</button>
              <button aria-label={`Delete ${c.title}`} onClick={() => remove(c.id)} style={{ flex: "none", width: 32, color: "var(--dim)" }}>×</button>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--dim)", display: "flex", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
          History never leaves this browser.
        </p>
      </aside>

      <section className="ch-main panel">
        <div className="ch-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
            <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label="Show chats" onClick={() => setSideOpen((o) => !o)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7" /></svg>
            </button>
            <label htmlFor="model" className="mono" style={{ fontSize: 10 }}>Model</label>
            <select id="model" className="select" style={{ width: "auto", maxWidth: 300, minHeight: 40, borderRadius: 999 }} value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {Object.entries(grouped).map(([g, ms]) => (
                <optgroup key={g} label={g}>
                  {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
              ))}
            </select>
            {model && <span className={"chip lane-" + model.lane}>{LANE[model.lane]}</span>}
            {model && sees(model) && <span className="chip cap">Sees images</span>}
            {model && draws(model) && <span className="chip cap">Makes images</span>}
          </div>
          {model && (
            <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
              {model.free ? "Free" : `${perMillion(model.promptPrice)} in · ${perMillion(model.completionPrice)} out / 1M`}
            </span>
          )}
        </div>

        <div className="ch-msgs" ref={scroller}>
          {messages.length === 0 ? (
            <div className="ch-empty">
              <span className="mono">Ask anything</span>
              <h1 className="h3" style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>What should we <span className="serif">think about?</span></h1>
              <p style={{ margin: 0, color: "var(--muted)", maxWidth: "46ch" }}>
                {me?.address ? "Ask, attach photos, PDFs and documents, or switch on Image to create one." : `Free models work without a wallet (${me?.freeDailyLimit ?? 20} messages a day). Connect a wallet for Claude, GPT, Gemini and image models.`}
              </p>
              <div className="ch-sugg">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          ) : (
            <div className="ch-inner">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-u-wrap">
                    {m.attachments?.length ? (
                      <div className="att-row att-row-sent">
                        {m.attachments.map((a, k) => (
                          a.kind === "image" ? (
                            <img key={k} className="att-thumb" src={a.data || a.thumb} alt={a.name} />
                          ) : (
                            <span key={k} className="att-chip"><FileGlyph kind={a.kind} /><span className="att-name">{a.name}</span></span>
                          )
                        ))}
                      </div>
                    ) : null}
                    {m.content && <div className="msg-u">{m.content}</div>}
                  </div>
                ) : (
                  <div key={i} className="msg-a">
                    <span className={"av" + (busy && i === messages.length - 1 ? " thinking" : "")} aria-hidden="true"><OrbitMark size={30} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {m.modelName && <div className="msg-model">{m.modelName}</div>}
                      {m.images?.length ? (
                        <div className="gen-grid">
                          {m.images.map((src, k) => (
                            <figure key={k} className="gen-img">
                              <img src={src} alt={`Generated image ${k + 1}`} />
                              <a className="btn btn-ghost btn-sm" href={src} download={`synaps-image-${Date.now()}-${k + 1}.png`}>Download</a>
                            </figure>
                          ))}
                        </div>
                      ) : null}
                      <div className="body">
                        {m.content ? <Markdown text={m.content} /> : null}
                        {busy && i === messages.length - 1 && (imageMode ? <span className="gen-wait">Creating image…</span> : <span className="caret" aria-hidden="true" />)}
                      </div>
                      {m.charged !== undefined && (
                        <div className="msg-meta"><span>{m.images?.length ? `${m.images.length} image${m.images.length > 1 ? "s" : ""}` : `${m.tokens ?? 0} tokens`}</span><span>{m.charged ? fmtUsd(m.charged, 4) : "Free"}</span></div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="ch-comp"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          {err && <div className="notice err" role="alert" style={{ maxWidth: 780, margin: "0 auto 10px" }}>{err}</div>}
          {warn && (
            <div className="notice warn-box" role="alert">
              <span>{warn.text}</span>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {warn.suggest && (
                  <button type="button" className="btn btn-violet btn-sm" onClick={() => { const s = warn.suggest!; setModelId(s.id); setWarn(null); send(input, { forceModel: s }); }}>
                    Switch to {warn.suggest.name} and send
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWarn(null)}>Dismiss</button>
              </span>
            </div>
          )}
          {imageMode && model && (
            <div className="img-hint" role="status">
              <span className="img-hint-dot" aria-hidden="true" />
              <span>
                <strong>Image mode on.</strong>{" "}
                {draws(model) ? `Describe the picture and ${model.name} will create it.` : `${model.name} can't create images. Describe the picture, then pick an image model when you send.`}
              </span>
              <button type="button" className="img-hint-x" aria-label="Turn off image mode" onClick={() => setImageMode(false)}>Off</button>
            </div>
          )}
          <form className="ch-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            {files.length > 0 && (
              <div className="att-row">
                {files.map((a, k) => (
                  <span key={k} className={"att-chip" + (a.kind === "image" ? " has-thumb" : "")}>
                    {a.kind === "image" ? <img src={a.thumb} alt="" className="att-mini" /> : <FileGlyph kind={a.kind} />}
                    <span className="att-name">{a.name}</span>
                    <span className="att-size">{fmtSize(a.size)}</span>
                    <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setFiles((f) => f.filter((_, j) => j !== k))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <label htmlFor="ask" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Message</label>
            <textarea
              id="ask"
              rows={2}
              value={input}
              placeholder={!model ? "Loading models…" : imageMode ? "Describe the image you want…" : `Message ${model.name}`}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
            />
            <div className="ch-form-row">
              <div className="ch-tools">
                <input ref={fileInput} id="attach" type="file" multiple accept={ACCEPT} hidden onChange={(e) => addFiles(e.target.files)} />
                <button type="button" className="tool-btn" aria-label="Attach photos, PDFs or documents" title="Attach photos, PDFs or documents" onClick={() => fileInput.current?.click()} disabled={reading || files.length >= MAX_FILES}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7" /></svg>
                  <span>{reading ? "Reading…" : "Attach"}</span>
                </button>
                <button type="button" className={"tool-btn" + (imageMode ? " on" : "")} aria-pressed={imageMode} title="Create an image" onClick={() => setImageMode((v) => !v)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></svg>
                  <span>{imageMode ? "Image on" : "Image"}</span>
                </button>
                <span className="num ch-estimate">{estimate}</span>
              </div>
              {busy ? (
                <button type="button" className="send" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="#14121c" /></svg>
                </button>
              ) : (
                <button type="submit" className="send" aria-label={imageMode ? "Create image" : "Send"} disabled={(!input.trim() && !files.length) || !model || reading}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14121c" strokeWidth="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              )}
            </div>
          </form>
          {model && <p className="ch-note">{LANE_NOTE[model.lane]}</p>}
        </div>
      </section>
    </div>
  );
}

function FileGlyph({ kind }: { kind: Attachment["kind"] }) {
  return (
    <span className={"file-glyph fg-" + kind} aria-hidden="true">{kind === "pdf" ? "PDF" : kind === "text" ? "TXT" : "IMG"}</span>
  );
}

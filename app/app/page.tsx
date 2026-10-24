"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/app/Session";
import { fmtUsd, perMillion } from "@/lib/money";
import type { Model } from "@/lib/models";
import { Markdown } from "@/components/app/Markdown";
import { OrbitMark } from "@/components/Logo";
import { deviceId } from "@/lib/device";
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
  hadImages?: number; // how many images a synced/reloaded message had
  sources?: { url: string; title?: string }[]; // web search citations
};
type Convo = { id: string; title: string; model: string; messages: Msg[]; at: number };
type Warn = { text: string; suggest?: Model };

const STORE = "synaps.chats.v1";
const INSTR = "synaps.instructions";
const SYNC = "synaps.sync";
const SHARES = "synaps.shares";
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
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
      images: undefined,
      hadImages: m.images?.length || m.hadImages || undefined,
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
  const { me, signIn, setBalance, setFreeLeft } = useSession();
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
  const [webMode, setWebMode] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncOn, setSyncOn] = useState(true);
  const [share, setShare] = useState<{ url?: string; token?: string; id?: string; busy?: boolean; err?: string } | null>(null);
  const dirty = useRef<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInstructions(lsGet(INSTR) || "");
    setSyncOn(lsGet(SYNC) !== "off");
    setConvos(load());
    fetch("/api/models").then((r) => r.json()).then((j) => {
      const list: Model[] = (j.models || []).map((m: Model) => ({ ...m, inputs: m.inputs || ["text"], outputs: m.outputs || ["text"] }));
      setModels(list);
      // ?model=<id> from a model page preselects that model
      const want = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("model") : null;
      const asked = want ? list.find((m) => m.id === want) : undefined;
      const def = asked || list.find((m) => m.free && /gpt-oss/.test(m.id)) || list.find((m) => m.free && !draws(m)) || list[0];
      if (def) setModelId((cur) => (asked ? asked.id : cur || def.id));
      if (asked && draws(asked) && !asked.outputs.includes("text")) setImageMode(true);
    }).catch(() => setErr("Could not load models. Refresh to try again."));
  }, []);

  const model = models.find((m) => m.id === modelId);
  const active = convos.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.images?.length]);
  useEffect(() => { setWarn(null); }, [modelId, imageMode, webMode, files.length]);

  const grouped = useMemo(() => {
    const g: Record<string, Model[]> = {};
    for (const m of models) (g[m.free ? "Free" : draws(m) ? "Image generation" : m.maker] ||= []).push(m);
    return g;
  }, [models]);

  // signed in: load instructions and synced chats; anything only this browser has gets uploaded
  useEffect(() => {
    if (!me?.address) return;
    let stop = false;
    (async () => {
      try {
        const r = await fetch("/api/settings", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const local = lsGet(INSTR) || "";
          if (j.instructions) { setInstructions(j.instructions); lsSet(INSTR, j.instructions); }
          else if (local) fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions: local }) }).catch(() => {});
        }
      } catch {}
      if (lsGet(SYNC) === "off") return;
      try {
        const r = await fetch("/api/chats", { cache: "no-store" });
        if (!r.ok || stop) return;
        const { chats } = (await r.json()) as { chats: Convo[] };
        setConvos((cs) => {
          const byId = new Map(cs.map((c) => [c.id, c]));
          for (const sc of chats) {
            const lc = byId.get(sc.id);
            if (!lc || (sc.at || 0) > (lc.at || 0)) byId.set(sc.id, sc);
          }
          const onServer = new Set(chats.map((c) => c.id));
          for (const c of cs) if (!onServer.has(c.id)) dirty.current.add(c.id);
          const merged = [...byId.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
          save(merged);
          return merged;
        });
      } catch {}
    })();
    return () => { stop = true; };
  }, [me?.address]);

  // push changed chats once a reply has finished
  useEffect(() => {
    if (!me?.address || !syncOn || busy || !dirty.current.size) return;
    const t = setTimeout(() => {
      const ids = [...dirty.current];
      dirty.current.clear();
      for (const id of ids) {
        const c = convos.find((x) => x.id === id);
        if (!c || !c.messages.length) continue;
        const messages = c.messages.map((m) => ({ ...m, attachments: m.attachments?.map(({ data, text, ...r }) => r), images: undefined, hadImages: m.images?.length || m.hadImages }));
        fetch(`/api/chats/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: c.title, model: c.model, at: c.at, messages }) })
          .then((r) => { if (!r.ok && r.status !== 413) dirty.current.add(id); })
          .catch(() => dirty.current.add(id));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [convos, busy, me?.address, syncOn]);

  function saveInstructions(text: string) {
    const v = text.slice(0, 2000);
    setInstructions(v);
    lsSet(INSTR, v);
    if (me?.address) fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions: v }) }).catch(() => {});
  }

  async function shareActive() {
    if (!active) return;
    const saved: Record<string, { id: string; token: string; url: string; n: number }> = JSON.parse(lsGet(SHARES) || "{}");
    const prev = saved[active.id];
    if (prev && prev.n === active.messages.length) { setShare({ url: prev.url, token: prev.token, id: prev.id }); return; }
    setShare({ busy: true });
    try {
      if (prev) fetch(`/api/share/${prev.id}`, { method: "DELETE", headers: { "x-delete-token": prev.token } }).catch(() => {});
      const r = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: active.title, model: active.model, messages: active.messages.map((m) => ({ ...m, attachments: m.attachments?.map(({ data, text, thumb, ...x }) => x), images: undefined, hadImages: m.images?.length || m.hadImages })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Could not create the link.");
      saved[active.id] = { id: j.id, token: j.delete_token, url: j.url, n: active.messages.length };
      lsSet(SHARES, JSON.stringify(saved));
      setShare({ url: j.url, token: j.delete_token, id: j.id });
    } catch (e: any) {
      setShare({ err: e?.message || "Could not create the link." });
    }
  }

  async function unshare() {
    if (!share?.id || !active) return;
    await fetch(`/api/share/${share.id}`, { method: "DELETE", headers: { "x-delete-token": share.token || "" } }).catch(() => {});
    const saved = JSON.parse(lsGet(SHARES) || "{}");
    delete saved[active.id];
    lsSet(SHARES, JSON.stringify(saved));
    setShare(null);
  }

  function update(id: string, fn: (c: Convo) => Convo) {
    dirty.current.add(id);
    setConvos((cs) => {
      const next = cs.map((c) => (c.id === id ? { ...fn(c), at: Date.now() } : c));
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
    if (webMode && !imageMode && mdl.free) {
      const s = suggestFor((m) => !m.free && m.outputs.includes("text") && !draws(m) && (!needsVision || sees(m)));
      setWarn({ text: `Web search works with paid models (about ${fmtUsd(20_000)} extra per message).${s ? ` Switch to ${s.name}?` : ""}`, suggest: s });
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
    const payload = JSON.stringify({ model: mdl.id, mode: imageMode ? "image" : "chat", web: webMode && !imageMode, instructions: instructions || undefined, messages: outgoing.map(toApi) });
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
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "x-syn-device": deviceId() }, body: payload, signal: ac.signal });
      const fl = res.headers.get("x-free-left");
      if (fl != null && fl !== "") setFreeLeft(Number(fl));
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
      const sources = new Map<string, { url: string; title?: string }>();
      const addCites = (list: any) => {
        if (!Array.isArray(list)) return false;
        let added = false;
        for (const a of list) {
          const c = a?.url_citation ?? a;
          if (typeof c?.url === "string" && !sources.has(c.url)) { sources.set(c.url, { url: c.url, title: c.title }); added = true; }
        }
        return added;
      };
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
          if (addCites(j.choices?.[0]?.delta?.annotations) || addCites(j.choices?.[0]?.message?.annotations)) patchLast({ sources: [...sources.values()] });
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
    dirty.current.delete(id);
    if (me?.address) fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => {});
    if (id === activeId) setActiveId("");
  }

  const estimate = !model ? "" : imageMode && !draws(model) ? "" : model.free ? (typeof me?.freeLeft === "number" ? `Free · ${me.freeLeft} left today` : "Free") : imageMode && draws(model)
    ? (model.imagePrice ? "≈ " + fmtUsd(Math.ceil(model.imagePrice * 1e6), 3) + " per image" : "Priced per image")
    : "≈ " + fmtUsd(Math.ceil(model.completionPrice * 800 * 1e6) + (webMode ? 20_000 : 0), 4) + " per reply" + (webMode ? " incl. web" : "");

  return (
    <div className="ch">
      <aside className={"ch-side panel" + (sideOpen ? " open" : "")} aria-label="Chats">
        <button className="btn btn-ghost" onClick={newChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New chat
        </button>
        <div className="ch-hist">
          {convos.length === 0 && <p style={{ color: "var(--dim)", fontSize: 13, padding: "8px 12px", margin: 0 }}>Your chats appear here.</p>}
          {convos.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
              <button className={c.id === activeId ? "on" : ""} style={{ flex: 1, minWidth: 0 }} onClick={() => { setActiveId(c.id); setModelId(c.model); setSideOpen(false); }}>{c.title}</button>
              <button aria-label={`Delete ${c.title}`} onClick={() => remove(c.id)} style={{ flex: "none", width: 32, color: "var(--dim)" }}>×</button>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--dim)", display: "flex", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
          {me?.address && syncOn ? "Synced to your wallet. Only you can see it." : "Saved in this browser only."}
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
          <div className="ch-bar-r">
            {model && (
              <span className="num ch-price">
                {model.free ? "Free" : `${perMillion(model.promptPrice)} in · ${perMillion(model.completionPrice)} out / 1M`}
              </span>
            )}
            <button className={"icon-btn" + (instructions ? " on-dot" : "")} style={{ width: 40, height: 40 }} aria-label="Instructions and settings" title="Instructions & settings" onClick={() => setSettingsOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
            </button>
            {active && active.messages.some((m) => m.role === "assistant" && m.content) && !busy && (
              <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label="Share this chat" title="Share this chat" onClick={shareActive}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 12v8h14v-8" /></svg>
              </button>
            )}
          </div>
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
                      {!m.images?.length && m.hadImages ? <p className="gen-gone">{m.hadImages} generated image{m.hadImages > 1 ? "s" : ""} — images aren&apos;t kept in history.</p> : null}
                      <div className="body">
                        {m.content ? <Markdown text={m.content} /> : null}
                        {busy && i === messages.length - 1 && (imageMode ? <span className="gen-wait">Creating image…</span> : webMode && !m.content ? <span className="gen-wait">Searching the web…</span> : <span className="caret" aria-hidden="true" />)}
                      </div>
                      {m.sources?.length ? (
                        <div className="srcs">
                          <span className="mono">Sources</span>
                          {m.sources.map((src, k) => (
                            <a key={k} className="src" href={src.url} target="_blank" rel="noreferrer nofollow" title={src.title || src.url}>
                              <span className="src-n num">{k + 1}</span>{src.title ? src.title.slice(0, 60) : host(src.url)}<span className="src-h">{host(src.url)}</span>
                            </a>
                          ))}
                        </div>
                      ) : null}
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
                <button type="button" className={"tool-btn" + (webMode ? " on" : "")} aria-pressed={webMode} title="Search the web (paid models)" onClick={() => setWebMode((v) => !v)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
                  <span>{webMode ? "Web on" : "Web"}</span>
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

      {settingsOpen && (
        <div className="dlg-back" role="dialog" aria-modal="true" aria-label="Instructions and settings" onClick={() => setSettingsOpen(false)}>
          <div className="dlg panel" onClick={(e) => e.stopPropagation()}>
            <h2>Instructions</h2>
            <p className="dlg-sub">Tell every model how to answer you: your language, tone, what you work on. Applies to all chats.</p>
            <textarea
              className="input dlg-ta"
              rows={6}
              maxLength={2000}
              placeholder={"e.g. Reply in Indonesian. Keep answers short. I build on Robinhood Chain, so assume Solidity and viem."}
              defaultValue={instructions}
              id="instr"
            />
            <label className="dlg-check">
              <input type="checkbox" checked={syncOn} onChange={(e) => { setSyncOn(e.target.checked); lsSet(SYNC, e.target.checked ? "on" : "off"); }} />
              <span>Sync chat history to my wallet{me?.address ? "" : " (after you connect)"}</span>
            </label>
            <p className="dlg-sub" style={{ marginTop: -4 }}>When on, your chats follow your wallet across devices. Attached files and generated images are never stored.</p>
            <div className="dlg-act">
              <button className="btn btn-ghost btn-sm" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="btn btn-violet btn-sm" onClick={() => { saveInstructions((document.getElementById("instr") as HTMLTextAreaElement)?.value || ""); setSettingsOpen(false); }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {share && (
        <div className="dlg-back" role="dialog" aria-modal="true" aria-label="Share chat" onClick={() => setShare(null)}>
          <div className="dlg panel" onClick={(e) => e.stopPropagation()}>
            <h2>Share this chat</h2>
            {share.busy && <p className="dlg-sub">Creating a link…</p>}
            {share.err && <div className="notice err">{share.err}</div>}
            {share.url && (
              <>
                <p className="dlg-sub">Anyone with the link can read this conversation as it is now. Attached files are not included.</p>
                <div className="inv-link"><code className="num">{share.url.replace(/^https?:\/\//, "")}</code>
                  <button className="btn btn-violet btn-sm" onClick={() => navigator.clipboard?.writeText(share.url!).catch(() => {})}>Copy</button>
                  <a className="btn btn-ghost btn-sm" href={`https://x.com/intent/post?text=${encodeURIComponent((active?.title || "A chat on Synaps") + " " + share.url)}`} target="_blank" rel="noreferrer">Post on X</a>
                </div>
                <div className="dlg-act">
                  <button className="btn btn-ghost btn-sm" onClick={unshare}>Stop sharing</button>
                  <button className="btn btn-violet btn-sm" onClick={() => setShare(null)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FileGlyph({ kind }: { kind: Attachment["kind"] }) {
  return (
    <span className={"file-glyph fg-" + kind} aria-hidden="true">{kind === "pdf" ? "PDF" : kind === "text" ? "TXT" : "IMG"}</span>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/app/Session";
import { fmtUsd, perMillion } from "@/lib/money";
import type { Model } from "@/lib/models";
import { Markdown } from "@/components/app/Markdown";

type Msg = { role: "user" | "assistant"; content: string; charged?: number; tokens?: number; error?: boolean };
type Convo = { id: string; title: string; model: string; messages: Msg[]; at: number };

const STORE = "synaps.chats.v1";
const LANE = { free: "Free", private: "No training", provider: "Provider can read" } as const;
const LANE_NOTE = {
  free: "Free model: the provider may log prompts to offer it at no cost.",
  private: "Routed only to providers that do not store or train on your prompts.",
  provider: "This model's maker can read this chat under their own policy.",
} as const;
const SUGGEST = ["Explain bonding curves in two sentences", "Write a launch tweet for a new token", "Review this Solidity function for bugs", "Translate “gm, frens” into Korean"];

function load(): Convo[] {
  try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; }
}
function save(c: Convo[]) {
  try { localStorage.setItem(STORE, JSON.stringify(c.slice(0, 50))); } catch {}
}
const uid = () => Math.random().toString(36).slice(2, 10);

export default function ChatPage() {
  const { me, signIn, setBalance } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setConvos(load());
    fetch("/api/models").then((r) => r.json()).then((j) => {
      const list: Model[] = j.models || [];
      setModels(list);
      const def = list.find((m) => m.free && /gpt-oss/.test(m.id)) || list.find((m) => m.free) || list[0];
      if (def) setModelId((cur) => cur || def.id);
    }).catch(() => setErr("Could not load models. Refresh to try again."));
  }, []);

  const model = models.find((m) => m.id === modelId);
  const active = convos.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages.length, messages[messages.length - 1]?.content]);

  const grouped = useMemo(() => {
    const g: Record<string, Model[]> = {};
    for (const m of models) (g[m.free ? "Free" : m.maker] ||= []).push(m);
    return g;
  }, [models]);

  function update(id: string, fn: (c: Convo) => Convo) {
    setConvos((cs) => {
      const next = cs.map((c) => (c.id === id ? fn(c) : c));
      save(next);
      return next;
    });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !model) return;
    setErr(null);
    if (!model.free && !me?.address) { await signIn(); return; }

    let id = activeId;
    let history: Msg[] = messages;
    if (!active) {
      id = uid();
      const c: Convo = { id, title: content.slice(0, 60), model: model.id, messages: [], at: Date.now() };
      setConvos((cs) => { const n = [c, ...cs]; save(n); return n; });
      setActiveId(id);
      history = [];
    }
    const outgoing: Msg[] = [...history, { role: "user", content }];
    update(id, (c) => ({ ...c, model: model.id, messages: [...outgoing, { role: "assistant", content: "" }] }));
    setInput("");
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, messages: outgoing.map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Something went wrong. Try again.");
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
          try {
            const j = JSON.parse(data);
            if (j.synaps) {
              const s = j.synaps;
              if (typeof s.balance_micros === "number") setBalance(s.balance_micros);
              update(id, (c) => {
                const ms = [...c.messages];
                ms[ms.length - 1] = { ...ms[ms.length - 1], charged: s.charged_micros, tokens: s.completion_tokens };
                return { ...c, messages: ms };
              });
              continue;
            }
            if (j.error) throw new Error(j.error.message || "The model stopped with an error.");
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              const snapshot = acc;
              update(id, (c) => {
                const ms = [...c.messages];
                ms[ms.length - 1] = { ...ms[ms.length - 1], content: snapshot };
                return { ...c, messages: ms };
              });
            }
          } catch (e: any) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErr(e?.message || "Something went wrong.");
        update(id, (c) => {
          const ms = [...c.messages];
          if (ms.length && ms[ms.length - 1].role === "assistant" && !ms[ms.length - 1].content) ms.pop();
          return { ...c, messages: ms };
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function newChat() { setActiveId(""); setErr(null); setSideOpen(false); }
  function remove(id: string) {
    setConvos((cs) => { const n = cs.filter((c) => c.id !== id); save(n); return n; });
    if (id === activeId) setActiveId("");
  }

  const estimate = model && !model.free ? "≈ " + fmtUsd(Math.ceil(model.completionPrice * 800 * 1e6), 4) + " per reply" : "Free";

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
                {me?.address ? "Pick any model above. You see the price before you send and the exact charge after." : `Free models work without a wallet (${me?.freeDailyLimit ?? 20} messages a day). Connect a wallet for Claude, GPT, Gemini and more.`}
              </p>
              <div className="ch-sugg">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          ) : (
            <div className="ch-inner">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-u">{m.content}</div>
                ) : (
                  <div key={i} className="msg-a">
                    <span className="av" aria-hidden="true" />
                    <div style={{ minWidth: 0 }}>
                      <div className="body">{m.content ? <Markdown text={m.content} /> : null}{busy && i === messages.length - 1 && <span className="caret" aria-hidden="true" />}</div>
                      {m.charged !== undefined && (
                        <div className="msg-meta"><span>{m.tokens ?? 0} tokens</span><span>{m.charged ? fmtUsd(m.charged, 4) : "Free"}</span></div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="ch-comp">
          {err && <div className="notice err" role="alert" style={{ maxWidth: 780, margin: "0 auto 10px" }}>{err}</div>}
          <form className="ch-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <label htmlFor="ask" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Message</label>
            <textarea
              id="ask"
              rows={2}
              value={input}
              placeholder={model ? `Message ${model.name}` : "Loading models…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
            />
            <div className="ch-form-row">
              <span className="num" style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 8 }}>{model ? estimate : ""}</span>
              {busy ? (
                <button type="button" className="send" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="#14121c" /></svg>
                </button>
              ) : (
                <button type="submit" className="send" aria-label="Send" disabled={!input.trim() || !model}>
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

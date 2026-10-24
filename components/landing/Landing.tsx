"use client";
import { useEffect, useRef } from "react";
import { Brand, OrbitMark } from "@/components/Logo";
import { XButton, XIcon } from "@/components/XLink";
import { X_URL, X_HANDLE } from "@/lib/site";
import { CopyButton } from "@/components/docs/CopyButton";
import { CHAINS } from "@/lib/chains";
import "./landing.css";

export type CardModel = {
  id: string;
  name: string;
  maker: string;
  context: number;
  lane: "free" | "private" | "provider";
  outPerM: string;
};

export type Receipt = { model: string; outTokensM: number; list: string; ours: string } | null;

const LANE_LABEL = { free: "Free", private: "No training", provider: "Provider" } as const;
const ARROW = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
);

function ctx(n: number) {
  if (n >= 1_000_000) return Math.round(n / 1_000_000) + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(n || "—");
}

const STATEMENT = "Every model you need, behind one balance in your wallet. You pay for the messages you send, and";

export default function Landing({ cards, receipt, markupPct, apiBase, token }: { cards: CardModel[]; receipt: Receipt; markupPct: number; apiBase: string; token?: { address: string; symbol: string; bonusPct?: number } | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const state = { scatter: 0, zoom: 6, fade: 1 };
    let core: { dispose(): void } | null = null;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const [{ createCore }, gsapMod, stMod, lenisMod] = await Promise.all([
        import("./core"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled) return;
      if (canvasRef.current) core = createCore(canvasRef.current, state, reduce);
      if (reduce) return;

      const gsap = gsapMod.gsap;
      const ScrollTrigger = stMod.ScrollTrigger;
      const Lenis = lenisMod.default;
      gsap.registerPlugin(ScrollTrigger);
      document.documentElement.classList.add("js-motion");

      const lenis = new Lenis({ duration: 1.15, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on("scroll", (e: any) => {
        ScrollTrigger.update();
        window.dispatchEvent(new CustomEvent("synaps:velocity", { detail: e.velocity }));
      });
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
      const onAnchor = (e: Event) => {
        const a = e.currentTarget as HTMLAnchorElement;
        const el = a.hash.length > 1 ? document.querySelector(a.hash) : null;
        if (el) { e.preventDefault(); lenis.scrollTo(el as HTMLElement, { offset: -80 }); }
      };
      anchors.forEach((a) => a.addEventListener("click", onAnchor));

      const ctxG = gsap.context(() => {
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .from("[data-line]", { yPercent: 110, duration: 1.4, stagger: 0.12 })
          .from("[data-intro]", { y: 24, opacity: 0, duration: 1.1, stagger: 0.08 }, "-=1.0")
          .from(".lp-canvas", { opacity: 0, duration: 2.2, ease: "power2.out" }, 0);

        gsap.timeline({ scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1 } })
          .to(".lp-hero-in", { y: -120, opacity: 0, scale: 0.96, ease: "none" }, 0)
          .to(state, { scatter: 1.1, zoom: 3.6, ease: "none" }, 0);

        gsap.to(state, { fade: 0.28, ease: "none", scrollTrigger: { trigger: ".lp-statement", start: "top 80%", end: "top 20%", scrub: true } });
        gsap.timeline({ scrollTrigger: { trigger: "#token", start: "top bottom", end: "center center", scrub: 1 } })
          .to(state, { fade: 0.85, scatter: 0.15, zoom: 5.2, ease: "none" });

        gsap.to(".lp-statement .w", { opacity: 1, stagger: 0.06, ease: "none", scrollTrigger: { trigger: "#stmt", start: "top 82%", end: "bottom 45%", scrub: true } });

        const track = document.getElementById("hzTrack")!;
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: ".lp-hz", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
        gsap.from(".lp-card", { y: 60, rotate: 2, stagger: 0.06, ease: "power3.out", duration: 1, scrollTrigger: { trigger: ".lp-hz", start: "top 75%" } });

        gsap.fromTo("#railFill", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#steps", start: "top 65%", end: "bottom 55%", scrub: true } });
        gsap.utils.toArray<HTMLElement>(".lp-step").forEach((s) =>
          ScrollTrigger.create({ trigger: s, start: "top 65%", end: "bottom 35%", toggleClass: { targets: s, className: "on" } })
        );

        gsap.fromTo("#receipt", { rotate: -12, y: 120, rotateX: 25 }, { rotate: -2.5, y: 0, rotateX: 0, ease: "none", scrollTrigger: { trigger: "#pricing", start: "top 85%", end: "center 55%", scrub: 1 } });
        gsap.from(".lp-priv-card", { y: 50, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".lp-priv-grid", start: "top 85%" } });
        gsap.to("#big", { backgroundSize: "100% 100%", ease: "none", scrollTrigger: { trigger: "#big", start: "top 85%", end: "bottom 40%", scrub: true } });
        gsap.from(".lp-tile", { y: 50, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".lp-tiles", start: "top 85%" } });
        gsap.from(".lp-cta-box", { scale: 0.92, ease: "none", scrollTrigger: { trigger: ".lp-cta", start: "top bottom", end: "top 40%", scrub: true } });
      });

      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener("load", onLoad);
      setTimeout(onLoad, 600);

      cleanup = () => {
        ctxG.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
        anchors.forEach((a) => a.removeEventListener("click", onAnchor));
        window.removeEventListener("load", onLoad);
        document.documentElement.classList.remove("js-motion");
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      core?.dispose();
    };
  }, []);

  const words = STATEMENT.split(" ");

  return (
    <div className="lp">
      <canvas ref={canvasRef} className="lp-canvas" aria-hidden="true" />
      <div className="atmos-glow" aria-hidden="true" />
      <div className="atmos-grain" aria-hidden="true" />

      <header className="lp-nav">
        <div className="lp-nav-in glass">
          <Brand />
          <nav className="lp-links" aria-label="Main">
            <a className="l" href="#models">Models</a>
            <a className="l" href="#how">How it works</a>
            <a className="l" href="#pricing">Pricing</a>
            <a className="l" href="/docs">Docs</a>
            <XButton />
            <a className="btn btn-glow" href="/app">Launch app</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero" id="top">
          <div className="wrap lp-hero-in">
            <p className="mono" data-intro>Pay-per-message AI · Robinhood Chain</p>
            <h1 className="h1">
              <span className="ln"><span data-line>Every model.</span></span>
              <span className="ln"><span data-line>One <span className="serif">wallet.</span></span></span>
            </h1>
            <p className="lp-lede" data-intro>Claude, GPT, Gemini, DeepSeek and more, paid per message from your wallet. No subscription and no card.</p>
            <div className="lp-ctas" data-intro>
              <a className="btn btn-solid" href="/app">Start chatting free {ARROW}</a>
              <a className="btn btn-ghost" href="#pricing">See pricing</a>
            </div>
            <ul className="lp-chips" data-intro>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12h2" /></svg>Top up from $1</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></svg>Privacy label on every model</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>History stays on your device</li>
            </ul>
          </div>
          <div className="lp-cue" aria-hidden="true"><span className="mono" style={{ fontSize: 10 }}>Scroll</span><i /></div>
        </section>

        <div className="lp-marq" aria-hidden="true">
          <div className="lp-marq-track">
            {[0, 1].map((k) => (
              <span key={k} style={{ display: "contents" }}>
                {(cards.length ? cards : []).map((c) => (
                  <span key={c.id + k} style={{ display: "contents" }}><span>{c.name}</span><b>✦</b></span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <section className="lp-statement">
          <div className="wrap">
            <p className="mono" style={{ marginBottom: 28 }}>The idea</p>
            <p className="big" id="stmt">
              {words.map((w, i) => (<span key={i}><span className="w">{w}</span> </span>))}
              <span className="serif"><span className="w">nothing</span> <span className="w">else.</span></span>
            </p>
          </div>
        </section>

        <section className="lp-hz" id="models" aria-label="Models">
          <div className="wrap lp-hz-head">
            <h2 className="h2">Every model,<br /><span className="serif">labeled.</span></h2>
            <p style={{ margin: 0, color: "var(--muted)", maxWidth: "36ch", fontSize: 17 }}>Each card says who can read your chat and what a million output tokens costs. Prices update live.</p>
          </div>
          <div className="lp-hz-track" id="hzTrack">
            {cards.map((c) => (
              <article className="lp-card" key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div><h3>{c.name}</h3><div className="maker">{c.maker}</div></div>
                  <span className={"lp-glyph t-" + c.lane}>{c.maker[0]}</span>
                </div>
                <hr />
                <dl>
                  <div><dt>Lane</dt><span className="dots" /><dd className={"t-" + c.lane}>{LANE_LABEL[c.lane]}</dd></div>
                  <div><dt>Context</dt><span className="dots" /><dd>{ctx(c.context)}</dd></div>
                  <div><dt>Per 1M out</dt><span className="dots" /><dd>{c.outPerM}</dd></div>
                </dl>
              </article>
            ))}
            <a className="lp-card" href="/app/models" style={{ textDecoration: "none", justifyContent: "center", alignItems: "flex-start" }}>
              <span className="mono">All models</span>
              <span className="h3">See the full <span className="serif">list</span> →</span>
            </a>
          </div>
        </section>

        <section className="lp-steps" id="how">
          <div className="wrap lp-steps-grid">
            <div className="lp-steps-sticky">
              <p className="mono">How it works</p>
              <h2 className="h2">Three steps,<br /><span className="serif">no forms.</span></h2>
            </div>
            <ol className="lp-steps-list" id="steps">
              <span className="lp-rail" aria-hidden="true"><i id="railFill" /></span>
              <li className="lp-step"><span className="dot" aria-hidden="true" /><p className="mono">Step 1</p><h3>Sign once</h3><p>Your wallet is the account. One signature, with no email, password or gas.</p></li>
              <li className="lp-step"><span className="dot" aria-hidden="true" /><p className="mono">Step 2</p><h3>Top up</h3><p>Send ETH on Robinhood Chain or Base, or USDC on Base. It becomes a USD balance only your wallet can spend.</p></li>
              <li className="lp-step"><span className="dot" aria-hidden="true" /><p className="mono">Step 3</p><h3>Send</h3><p>Pick any model. You see its price before you send, and the exact charge after.</p></li>
            </ol>
          </div>
        </section>

        <section className="lp-price" id="pricing">
          <div className="wrap lp-price-grid">
            <div className="lp-price-copy">
              <p className="mono">Pricing</p>
              <h2 className="h2">The price you see is <span className="serif">the price you pay.</span></h2>
              <p>No plans and no monthly bill. Every message is billed at the provider&apos;s cost plus a flat {markupPct}%, shown on every model before you send.</p>
            </div>
            <div className="lp-receipt-wrap">
              <div className="lp-receipt" id="receipt">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div><div className="k" style={{ fontSize: 11, letterSpacing: ".2em" }}>EXAMPLE BILL</div><div style={{ fontFamily: "var(--f-sans)", fontWeight: 600, fontSize: 24, letterSpacing: "-.03em", marginTop: 2 }}>Synaps</div></div>
                  <div className="k" style={{ textAlign: "right", fontSize: 11, letterSpacing: ".14em" }}>OUTPUT<br />TOKENS ONLY</div>
                </div>
                <hr className="cut" />
                <div className="row k" style={{ fontSize: 11, letterSpacing: ".14em" }}><span>MODEL</span><span>USAGE</span></div>
                <div className="row"><span>{receipt?.model ?? "A premium model"}</span><span>{receipt ? receipt.outTokensM + "M tok" : "—"}</span></div>
                <hr className="cut" />
                <div className="row"><span className="k">Provider list price</span><span>{receipt?.list ?? "—"}</span></div>
                <div className="row"><span className="k">Synaps fee</span><span>+{markupPct}%</span></div>
                <div className="row"><span className="k">Subscription</span><span>$0</span></div>
                <hr className="cut" />
                <div className="row" style={{ alignItems: "baseline" }}><span style={{ fontSize: 12, letterSpacing: ".16em" }}>YOU PAY</span><span className="total">{receipt?.ours ?? "—"}</span></div>
                <div className="bar" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-priv">
          <div className="wrap">
            <p className="mono">Privacy</p>
            <h2 className="h2" style={{ marginTop: 18 }}>Labeled, <span className="serif">not promised.</span></h2>
            <div className="lp-priv-grid">
              <div className="lp-priv-card" style={{ borderColor: "rgba(111,227,240,.3)" }}><span className="chip lane-free">Free</span><h3>Free models</h3><p>Open models at no cost, a few a day. The provider may log prompts to offer them free.</p></div>
              <div className="lp-priv-card" style={{ borderColor: "rgba(165,148,255,.3)" }}><span className="chip lane-private">No training</span><h3>Open models, paid</h3><p>Routed only to providers that do not store or train on your prompts.</p></div>
              <div className="lp-priv-card" style={{ borderColor: "rgba(232,167,124,.3)" }}><span className="chip lane-provider">Provider</span><h3>Claude, GPT, Gemini</h3><p>Sent to the model&apos;s maker under their own policy. We say so on the model, every time.</p></div>
            </div>
            <p style={{ color: "var(--muted)", marginTop: 28 }}>No trackers and no ads. Your chat history is stored in your browser, not on our servers.</p>
          </div>
        </section>

        <section className="lp-dev" id="developers">
          <div className="wrap lp-dev-grid">
            <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              <p className="mono">Developers</p>
              <h2 className="h2">Change <span className="serif">one line.</span></h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 19, fontWeight: 300, maxWidth: "40ch" }}>An OpenAI-compatible endpoint with streaming and tool calls. Your API key spends the same balance as the chat.</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a className="btn btn-glow" href="/app/keys">Create API key {ARROW}</a>
                <a className="btn btn-ghost" href="/docs">Read the docs</a>
              </div>
            </div>
            <div className="lp-code">
              <pre>{`from openai import OpenAI

client = OpenAI(
    base_url="${apiBase}",
    api_key=os.environ["SYNAPS_API_KEY"],
)

reply = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[{"role": "user", "content": "gm"}],
)`}</pre>
            </div>
          </div>
        </section>

        <section className="lp-token" id="token">
          <div className="wrap">
            <p className="mono" style={{ marginBottom: 22 }}>The token</p>
            <h2 className="lp-big" id="big">$SYNAPS</h2>
            {token ? (
              <>
                <p style={{ margin: "28px auto 22px", maxWidth: "38ch", color: "var(--muted)", fontSize: 19, fontWeight: 300 }}>Live on Pons. Launched from the Synaps treasury wallet.</p>
                <div className="lp-ca">
                  <span className="mono lp-ca-k">Contract</span>
                  <code className="lp-ca-v">{token.address}</code>
                  <span className="lp-ca-btns">
                    <CopyButton text={token.address} />
                    <a href={`${CHAINS.robinhood.explorer}/token/${token.address}`} target="_blank" rel="noreferrer">Explorer ↗</a>
                  </span>
                </div>
                <p style={{ margin: "0 auto 56px", fontSize: 13, color: "var(--dim)" }}>Always check the contract matches this one. Any other address is not ours.</p>
              </>
            ) : (
              <p style={{ margin: "28px auto 56px", maxWidth: "38ch", color: "var(--muted)", fontSize: 19, fontWeight: 300 }}>Coming on Pons. Synaps works today with ETH and USDC; the token will make your balance go further.</p>
            )}
            <div className="lp-tiles">
              <div className="lp-tile"><strong>Bonus credit</strong><span className="mono" style={{ fontSize: 11 }}>Pay with $SYNAPS</span><p>{token?.bonusPct ? `Top up with the token and get +${token.bonusPct}% extra credit, on the Wallet page.` : "Top up with the token and get more credit for the same amount. Rate announced at launch."}</p></div>
              <div className="lp-tile"><strong>Public treasury</strong><span className="mono" style={{ fontSize: 11 }}>On-chain</span><p>Top-ups and creator fees land in one wallet anyone can check.</p></div>
              {token ? (
                <div className="lp-tile"><strong>Pons</strong><span className="mono" style={{ fontSize: 11 }}>Live · Robinhood Chain</span><p>Launched by the treasury wallet, so anyone can verify it on-chain. Updates on X ({X_HANDLE}).</p></div>
              ) : (
                <div className="lp-tile"><strong>Pons</strong><span className="mono" style={{ fontSize: 11 }}>Launch · TBA</span><p>The contract appears here automatically when the treasury wallet launches it, and on X ({X_HANDLE}). Anything else is not ours.</p></div>
              )}
            </div>
            <p style={{ marginTop: 28, fontSize: 13, color: "var(--dim)" }}>{token ? "$SYNAPS is a utility token." : "$SYNAPS will be a utility token."} It is not an investment and nothing here is financial advice.</p>
          </div>
        </section>

        <section className="lp-cta">
          <div className="wrap">
            <div className="lp-cta-box">
              <span className="lp-cta-logo"><OrbitMark size={104} /></span>
              <h2 className="h2" style={{ fontSize: "clamp(44px, 8vw, 112px)" }}>Think out loud.<br /><span className="serif">Pay per thought.</span></h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 19, fontWeight: 300 }}>Free models need nothing. Premium ones need a wallet and $1.</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <a className="btn btn-solid" href="/app" style={{ minHeight: 56, padding: "0 30px", fontSize: 16 }}>Launch Synaps {ARROW}</a>
                <a className="btn btn-ghost" href={X_URL} target="_blank" rel="noreferrer" style={{ minHeight: 56, padding: "0 26px", fontSize: 16 }}><XIcon size={15} /> Follow {X_HANDLE}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="wrap lp-foot-in">
          <Brand size={28} />
          <nav aria-label="Footer"><a href="/app">App</a><a href="/app/models">Models</a><a href="/docs">Docs</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav>
          <a className="x-handle" href={X_URL} target="_blank" rel="noreferrer"><XIcon size={14} />{X_HANDLE}</a>
          <span>© 2026 Synaps · Robinhood Chain</span>
        </div>
      </footer>
    </div>
  );
}

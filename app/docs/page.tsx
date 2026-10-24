import { Brand } from "@/components/Logo";
import { env } from "@/lib/env";
import "@/components/app/app.css";

export const metadata = { title: "Docs" };

const box: React.CSSProperties = { margin: 0, padding: 20, borderRadius: 16, background: "#0a0910", border: "1px solid var(--line)", fontFamily: "var(--f-mono)", fontSize: 13.5, lineHeight: 1.75, color: "#d8d5e8", overflowX: "auto" };

export default function Docs() {
  const base = env.siteUrl.replace(/\/$/, "") + "/api/v1";
  const py = `from openai import OpenAI
import os

client = OpenAI(base_url="${base}", api_key=os.environ["SYNAPS_API_KEY"])

stream = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[{"role": "user", "content": "Explain a bonding curve in one paragraph."}],
    stream=True,
)
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;
  const ts = `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${base}", apiKey: process.env.SYNAPS_API_KEY });

const reply = await client.chat.completions.create({
  model: "deepseek/deepseek-chat",
  messages: [{ role: "user", content: "gm" }],
});
console.log(reply.choices[0].message.content, reply.usage);`;
  const curl = `curl ${base}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek/deepseek-chat","messages":[{"role":"user","content":"gm"}]}'`;

  return (
    <div className="ap">
      <div className="atmos-glow" aria-hidden="true" />
      <header className="ap-top">
        <div className="ap-top-in glass">
          <div className="ap-left" style={{ paddingLeft: 6 }}><Brand size={30} /></div>
          <div className="ap-right">
            <a className="btn btn-ghost btn-sm" href="/app/models">Models</a>
            <a className="btn btn-glow btn-sm" href="/app/keys">Get API key</a>
          </div>
        </div>
      </header>
      <main className="ap-body">
        <div className="pg" style={{ maxWidth: 860 }}>
          <div className="pg-head"><div><p className="mono">Docs</p><h1>Quickstart in <span className="serif">two minutes.</span></h1></div></div>

          <section className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="h3" style={{ fontSize: 24 }}>1. Get a key</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>Connect your wallet, top up from $1 on the <a href="/app/wallet">Wallet</a> page, then create a key on <a href="/app/keys">API keys</a>. Keys start with <code className="num">syn_</code> and spend the same balance as the chat.</p>
          </section>

          <section className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="h3" style={{ fontSize: 24 }}>2. Point your SDK at Synaps</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>The API is OpenAI-compatible. Change the base URL to <code className="num" style={{ color: "var(--fg)" }}>{base}</code> and keep the rest of your code.</p>
            <p className="mono" style={{ margin: "6px 0 0" }}>Python</p>
            <pre style={box}>{py}</pre>
            <p className="mono" style={{ margin: "6px 0 0" }}>TypeScript</p>
            <pre style={box}>{ts}</pre>
            <p className="mono" style={{ margin: "6px 0 0" }}>cURL</p>
            <pre style={box}>{curl}</pre>
          </section>

          <section className="panel card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h3" style={{ fontSize: 24 }}>Reference</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Endpoint</th><th>What it does</th></tr></thead>
                <tbody>
                  <tr><td className="num">POST /api/v1/chat/completions</td><td style={{ color: "var(--muted)" }}>Chat completion, with <code>stream</code>, <code>tools</code>, <code>response_format</code> and the usual sampling fields.</td></tr>
                  <tr><td className="num">GET /api/v1/models</td><td style={{ color: "var(--muted)" }}>Every model ID with context length, privacy lane and price per million tokens.</td></tr>
                </tbody>
              </table>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Model IDs follow <code className="num">maker/model</code>, for example <code className="num">anthropic/…</code> or <code className="num">deepseek/…</code>. Use <a href="/app/models">Models</a> to copy exact IDs.</li>
              <li><code className="num">usage.cost</code> in each response is what you were charged, in USD.</li>
              <li>Errors: <code className="num">401</code> bad key, <code className="num">402</code> balance too low, <code className="num">429</code> key&apos;s daily limit reached.</li>
              <li>Paid open models are routed only to providers that do not train on prompts. Closed models follow their maker&apos;s policy.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

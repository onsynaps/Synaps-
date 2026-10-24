import { BASE, Code, DocTitle, Pager, MARKUP_PCT } from "@/components/docs/kit";

export const metadata = { title: "Overview" };

export default function Overview() {
  return (
    <article>
      <DocTitle
        eyebrow="Overview"
        title={<>One API for <span className="serif">every model.</span></>}
        lede="Synaps gives you Claude, GPT, Gemini, DeepSeek, Qwen and more behind a single OpenAI-compatible endpoint, billed per request from a USD balance you top up with crypto."
      />

      <h2>What you get</h2>
      <ul>
        <li><strong>One key, many models.</strong> Switch providers by changing the <code>model</code> string. No new accounts, no separate bills.</li>
        <li><strong>OpenAI-compatible.</strong> Point any OpenAI SDK or tool at Synaps by changing the base URL.</li>
        <li><strong>Pay per request.</strong> No subscription. Every call is billed at the provider&apos;s cost plus a flat {MARKUP_PCT}% fee, and each response tells you exactly what it cost.</li>
        <li><strong>Wallet account.</strong> Sign in by signing a message. Top up with ETH on Robinhood Chain or Base, or USDC on Base.</li>
        <li><strong>Privacy labels.</strong> Every model says who can read your prompts.</li>
      </ul>

      <h2>Base URL</h2>
      <Code lang="text" code={BASE} />
      <p>Every endpoint in these docs is relative to this URL. Requests need an API key in the <code>Authorization</code> header; see <a href="/docs/authentication">Authentication</a>.</p>

      <h2>Endpoints</h2>
      <div className="dc-table">
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>POST</code></td><td><code>/chat/completions</code></td><td>Generate a reply from any model. Supports streaming, tools and JSON output. <a href="/docs/chat-completions">Reference</a></td></tr>
            <tr><td><code>GET</code></td><td><code>/models</code></td><td>List every model with its context length, privacy lane and price. <a href="/docs/models">Reference</a></td></tr>
          </tbody>
        </table>
      </div>

      <h2>A first request</h2>
      <Code
        lang="bash"
        code={`curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "Say hello in five words."}]
  }'`}
      />

      <h2>Where to go next</h2>
      <div className="dc-cards">
        <a href="/docs/quickstart">Quickstart<span>Key, top-up and first call in two minutes.</span></a>
        <a href="/docs/chat-completions">Chat completions<span>Every request field and response field.</span></a>
        <a href="/docs/billing">Billing &amp; pricing<span>How each request is priced and charged.</span></a>
        <a href="/docs/integrations">Integrations<span>LangChain, Vercel AI SDK, Cursor and more.</span></a>
      </div>

      <Pager next={{ href: "/docs/quickstart", label: "Quickstart" }} />
    </article>
  );
}

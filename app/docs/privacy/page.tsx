import { Callout, DocTitle, Pager } from "@/components/docs/kit";

export const metadata = { title: "Privacy lanes" };

export default function PrivacyLanes() {
  return (
    <article>
      <DocTitle eyebrow="Account" title={<>Privacy <span className="serif">lanes.</span></>} lede="Every model carries a label that says who can read what you send it. Pick the lane that fits the data." />

      <h2>The three lanes</h2>
      <div className="dc-table">
        <table>
          <thead><tr><th>Lane</th><th>Who handles the prompt</th><th>Good for</th></tr></thead>
          <tbody>
            <tr><td><span className="chip lane-free">Free</span></td><td>A provider offering the model at no cost. It may log prompts and use them to improve its service.</td><td>Testing, public data, casual use.</td></tr>
            <tr><td><span className="chip lane-private">No training</span></td><td>Open-weight models served only by providers that do not store or train on prompts. Synaps enforces this on every paid request to these models.</td><td>Work data, code, drafts you would rather keep private.</td></tr>
            <tr><td><span className="chip lane-provider">Provider</span></td><td>The model&apos;s maker (Anthropic, OpenAI, Google, xAI) under its own API data policy.</td><td>When you need that specific model and accept the maker&apos;s policy.</td></tr>
          </tbody>
        </table>
      </div>
      <p>The lane appears on every model in the chat, on the <a href="/app/models">Models page</a>, and as <code>privacy_lane</code> in <a href="/docs/models"><code>GET /models</code></a>.</p>

      <h2>What Synaps itself keeps</h2>
      <ul>
        <li><strong>Not stored:</strong> prompts and replies sent through the API, and chats from signed-out use or with sync turned off. They pass through to the model and are not written to our database. Attached file contents and generated images are never stored.</li>
        <li><strong>Synced (signed in, sync on):</strong> the text of your chats, so they follow your wallet across devices. Only your wallet can read them; turn sync off in the chat&apos;s Instructions &amp; settings.</li>
        <li><strong>Stored:</strong> for each request, the time, model, token counts and amount charged, so billing and your activity list work.</li>
      </ul>
      <p>The full details are in the <a href="/privacy">Privacy Policy</a>.</p>

      <Callout kind="warn" title="Never send secrets">No lane is a safe place for private keys, seed phrases, passwords or other credentials. Do not paste them into any model.</Callout>

      <h2>Choosing by data type</h2>
      <ul>
        <li><strong>Public or test content:</strong> any lane, including free.</li>
        <li><strong>Business documents, source code:</strong> No training lane, or a Provider model whose maker&apos;s API terms you have read.</li>
        <li><strong>Personal data about others:</strong> only if you have the right to process it, in the No training lane, and with as little detail as the task needs.</li>
      </ul>

      <Pager prev={{ href: "/docs/errors", label: "Errors" }} next={{ href: "/docs/integrations", label: "Integrations" }} />
    </article>
  );
}

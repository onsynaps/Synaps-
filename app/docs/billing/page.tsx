import { Callout, Code, DocTitle, Pager, MARKUP_PCT, MIN_BALANCE } from "@/components/docs/kit";

export const metadata = { title: "Billing & pricing" };

export default function Billing() {
  return (
    <article>
      <DocTitle eyebrow="Account" title={<>Billing <span className="serif">&amp; pricing.</span></>} lede="No plans and no subscriptions. You pay for the tokens each request uses, from one prepaid USD balance." />

      <h2>How a request is priced</h2>
      <p>Every model has a price per million input tokens and per million output tokens, set by its provider. Synaps adds a flat <strong>{MARKUP_PCT}%</strong> on top. That is the whole fee: no per-request charge, no minimum spend, no monthly cost.</p>
      <Code
        lang="text"
        code={`charge = provider_cost × ${(1 + MARKUP_PCT / 100).toFixed(2)}

provider_cost = input_tokens  × input_price_per_token
              + output_tokens × output_price_per_token`}
      />
      <p>The provider reports the exact cost of each request, and Synaps uses that figure. Prices on the <a href="/app/models">Models page</a> and from <a href="/docs/models"><code>GET /models</code></a> already include the fee.</p>

      <h2>Worked example</h2>
      <p>Suppose a model lists at $3 per million input tokens and $15 per million output tokens, and you send 2,000 input tokens and get 500 output tokens back:</p>
      <div className="dc-table">
        <table>
          <tbody>
            <tr><td>Input</td><td>2,000 × $3 / 1,000,000</td><td style={{ textAlign: "right" }}>$0.0060</td></tr>
            <tr><td>Output</td><td>500 × $15 / 1,000,000</td><td style={{ textAlign: "right" }}>$0.0075</td></tr>
            <tr><td>Provider cost</td><td></td><td style={{ textAlign: "right" }}>$0.0135</td></tr>
            <tr><td><strong>You pay</strong></td><td>× {(1 + MARKUP_PCT / 100).toFixed(2)}</td><td style={{ textAlign: "right" }}><strong>${(0.0135 * (1 + MARKUP_PCT / 100)).toFixed(4)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <h2>When you are charged</h2>
      <ul>
        <li>Charges happen <strong>after</strong> each request finishes, using the final usage the provider reports.</li>
        <li>Paid requests need at least <strong>${MIN_BALANCE}</strong> in your balance to start. Below that, they return <code>402</code>.</li>
        <li>Your balance never goes below zero. If a long reply costs more than what is left, the balance stops at $0.00.</li>
        <li>Failed requests that return an error before any output are not charged.</li>
        <li>Streams you stop early are charged for what the provider generated. See <a href="/docs/streaming">Streaming</a>.</li>
      </ul>

      <h2>Seeing what you spent</h2>
      <ul>
        <li><strong>Per request:</strong> <code>usage.cost</code> in every response is the USD amount charged.</li>
        <li><strong>In the app:</strong> the chat shows the cost under each reply; <a href="/app/wallet">Wallet</a> lists every request and top-up.</li>
        <li><strong>Per key:</strong> <a href="/app/keys">API keys</a> shows each key&apos;s spending over the last 7 days.</li>
      </ul>

      <h2>Free models</h2>
      <p>Models whose ID ends in <code>:free</code> cost nothing and are never charged. They have daily limits (see <a href="/docs/rate-limits">Rate limits</a>), may be slower, and their providers may log prompts.</p>

      <h2>Web search</h2>
      <p>With <strong>Web</strong> turned on in the chat, the model reads live search results before answering and cites its sources. Each such message costs the normal model price plus a flat <strong>$0.02</strong> for the search. Web search is available with paid models only.</p>

      <h2>Controlling spend</h2>
      <ul>
        <li>Set <code>max_tokens</code> on each request to cap the output.</li>
        <li>Give each API key a <strong>daily limit</strong> so one runaway script cannot drain the balance.</li>
        <li>Use a separate key per app or bot, so you can see and revoke them individually.</li>
        <li>Top up in small amounts. There is no penalty for topping up often.</li>
      </ul>

      <Callout kind="warn" title="Balance is prepaid credit">Your balance can only be spent on Synaps. It cannot be withdrawn or transferred, and it is not refunded except as described in the <a href="/terms">Terms</a>.</Callout>

      <Pager prev={{ href: "/docs/models", label: "Models" }} next={{ href: "/docs/top-ups", label: "Top-ups" }} />
    </article>
  );
}

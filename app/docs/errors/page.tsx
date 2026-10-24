import { Code, DocTitle, Pager, MIN_BALANCE } from "@/components/docs/kit";

export const metadata = { title: "Errors" };

export default function Errors() {
  return (
    <article>
      <DocTitle eyebrow="Account" title={<>Errors</>} lede="Errors come back as JSON with a readable message and a standard HTTP status." />

      <h2>Error shape</h2>
      <Code lang="json" code={`{
  "error": {
    "message": "Insufficient balance. Top up at /app/wallet.",
    "code": 402
  }
}`} />
      <p><code>message</code> is always present and safe to show to a developer. <code>code</code> is included when the error came from the model provider.</p>

      <h2>Status codes</h2>
      <div className="dc-table">
        <table>
          <thead><tr><th>Status</th><th>Meaning</th><th>What to do</th></tr></thead>
          <tbody>
            <tr><td><code>400</code></td><td>The request is malformed: missing <code>model</code> or <code>messages</code>, or invalid JSON.</td><td>Fix the body. Do not retry unchanged.</td></tr>
            <tr><td><code>401</code></td><td>The API key is missing, wrong or revoked.</td><td>Check the header and the key on <a href="/app/keys">API keys</a>.</td></tr>
            <tr><td><code>402</code></td><td>Balance below ${MIN_BALANCE} for a paid model.</td><td><a href="/app/wallet">Top up</a>, or use a <code>:free</code> model.</td></tr>
            <tr><td><code>404</code></td><td>The model ID is not available.</td><td>Copy an ID from <a href="/docs/models"><code>GET /models</code></a>.</td></tr>
            <tr><td><code>429</code></td><td>A rate limit, the free-model quota, or the key&apos;s daily spending limit was reached.</td><td>Back off and retry, or raise the key&apos;s limit. See <a href="/docs/rate-limits">Rate limits</a>.</td></tr>
            <tr><td><code>500</code></td><td>Something failed on Synaps. The body may not be JSON.</td><td>Retry once. If it persists, contact us with the time of the request.</td></tr>
            <tr><td><code>502</code> / <code>503</code></td><td>The model provider is down, overloaded, or Synaps is temporarily unavailable.</td><td>Retry after a few seconds, or switch models.</td></tr>
            <tr><td>Other <code>4xx</code></td><td>Passed through from the provider, for example a context window exceeded or content refused.</td><td>Read <code>message</code>; shorten the input or change the request.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Which errors cost money</h2>
      <p>Errors returned before the model produced output are free. A stream that fails partway is charged for the tokens the provider generated up to that point.</p>

      <h2>Handling errors with the OpenAI SDK</h2>
      <Code
        lang="python"
        code={`from openai import APIStatusError, AuthenticationError, RateLimitError

try:
    reply = client.chat.completions.create(model="deepseek/deepseek-chat", messages=messages)
except AuthenticationError:
    print("Bad or revoked key")
except RateLimitError as e:
    print("Slow down:", e.message)
except APIStatusError as e:
    if e.status_code == 402:
        print("Top up your Synaps balance")
    else:
        print(e.status_code, e.message)`}
      />

      <Pager prev={{ href: "/docs/rate-limits", label: "Rate limits" }} next={{ href: "/docs/privacy", label: "Privacy lanes" }} />
    </article>
  );
}

import { Callout, Code, DocTitle, Pager, FREE_DAILY } from "@/components/docs/kit";

export const metadata = { title: "Rate limits" };

export default function RateLimits() {
  return (
    <article>
      <DocTitle eyebrow="Account" title={<>Rate limits</>} lede="Limits keep Synaps fast and fair for everyone. Here is every one of them." />

      <div className="dc-table">
        <table>
          <thead><tr><th>Where</th><th>Limit</th><th>Applies to</th></tr></thead>
          <tbody>
            <tr><td>API</td><td><strong>60 requests / minute</strong></td><td>Each API key</td></tr>
            <tr><td>API, free models</td><td><strong>{FREE_DAILY * 5} requests / day</strong></td><td>Each API key, on <code>:free</code> models</td></tr>
            <tr><td>API, your own cap</td><td>Your daily USD limit</td><td>Keys you gave a daily limit</td></tr>
            <tr><td>Chat app</td><td><strong>30 messages / minute</strong></td><td>Each wallet, or each IP when signed out</td></tr>
            <tr><td>Chat app, free models</td><td><strong>{FREE_DAILY} messages / day</strong></td><td>Each IP address</td></tr>
          </tbody>
        </table>
      </div>
      <p>Daily limits reset at midnight UTC. Per-minute limits use a fixed one-minute window.</p>

      <h2>When you hit a limit</h2>
      <p>The request returns HTTP <code>429</code> with a message saying which limit was reached:</p>
      <Code lang="json" code={`{ "error": { "message": "Rate limit: 60 requests per minute per key. Slow down and retry." } }`} />

      <h2>Handling 429 well</h2>
      <p>Retry with exponential backoff and a little randomness, and stop after a few attempts:</p>
      <Code
        lang="python"
        code={`import random, time
from openai import OpenAI, RateLimitError

def ask(messages, tries=5):
    for attempt in range(tries):
        try:
            return client.chat.completions.create(model="deepseek/deepseek-chat", messages=messages)
        except RateLimitError:
            time.sleep(min(30, 2 ** attempt) + random.random())
    raise RuntimeError("Still rate limited after retries")`}
      />
      <Callout kind="tip" title="Need more throughput?">Spread traffic across several keys, one per service. Each key has its own per-minute limit.</Callout>

      <h2>Provider limits</h2>
      <p>Model providers have their own capacity limits. If a provider is overloaded you may get a <code>429</code> or <code>503</code> passed through from them even under your Synaps limits. Retrying after a short wait, or switching to another model, usually works.</p>

      <Pager prev={{ href: "/docs/top-ups", label: "Top-ups" }} next={{ href: "/docs/errors", label: "Errors" }} />
    </article>
  );
}

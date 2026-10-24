import { BASE, Callout, Code, DocTitle, Pager, FREE_DAILY } from "@/components/docs/kit";

export const metadata = { title: "Quickstart" };

export default function Quickstart() {
  return (
    <article>
      <DocTitle eyebrow="Getting started" title={<>Quickstart in <span className="serif">two minutes.</span></>} lede="From zero to a working API call: connect a wallet, add balance, create a key, send a request." />

      <h2>1. Connect your wallet</h2>
      <p>Open the <a href="/app">app</a> and press <strong>Connect wallet</strong>. Your wallet asks you to sign a short message. Signing is free, sends no transaction, and grants Synaps no permission over your funds. It only proves you own the address.</p>
      <Callout kind="tip" title="No wallet yet?">Free models work in the chat without a wallet, up to {FREE_DAILY} messages a day. You need a wallet for paid models and for API keys.</Callout>

      <h2>2. Top up your balance</h2>
      <p>Go to <a href="/app/wallet">Wallet</a>, pick an asset and an amount, and press <strong>Pay in wallet</strong>. Synaps waits for the transaction to confirm on-chain, then credits your balance in USD. See <a href="/docs/top-ups">Top-ups</a> for networks and details.</p>

      <h2>3. Create an API key</h2>
      <p>On <a href="/app/keys">API keys</a>, give the key a name and, if you like, a daily spending limit. Copy the key right away; it starts with <code>syn_</code> and is shown only once.</p>
      <Code lang="bash" code={`export SYNAPS_API_KEY="syn_your_key_here"`} />

      <h2>4. Make a request</h2>
      <h3>Python</h3>
      <Code lang="bash" code="pip install openai" />
      <Code
        lang="python"
        code={`import os
from openai import OpenAI

client = OpenAI(
    base_url="${BASE}",
    api_key=os.environ["SYNAPS_API_KEY"],
)

reply = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "What is a bonding curve?"},
    ],
)

print(reply.choices[0].message.content)
print("Charged (USD):", reply.usage.cost)`}
      />

      <h3>TypeScript / Node.js</h3>
      <Code lang="bash" code="npm install openai" />
      <Code
        lang="typescript"
        code={`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE}",
  apiKey: process.env.SYNAPS_API_KEY,
});

const reply = await client.chat.completions.create({
  model: "deepseek/deepseek-chat",
  messages: [{ role: "user", content: "What is a bonding curve?" }],
});

console.log(reply.choices[0].message.content);
console.log("Charged (USD):", (reply.usage as any).cost);`}
      />

      <h3>cURL</h3>
      <Code
        lang="bash"
        code={`curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek/deepseek-chat","messages":[{"role":"user","content":"gm"}]}'`}
      />

      <h2>5. Pick a model</h2>
      <p>Browse every model and its price on the <a href="/app/models">Models</a> page, or list them from code with <a href="/docs/models"><code>GET /models</code></a>. Use the exact <code>id</code> shown there, for example <code>anthropic/…</code>, <code>openai/…</code> or <code>google/…</code>.</p>

      <Pager prev={{ href: "/docs", label: "Overview" }} next={{ href: "/docs/authentication", label: "Authentication" }} />
    </article>
  );
}

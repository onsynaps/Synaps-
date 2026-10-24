import { BASE, Callout, Code, DocTitle, Pager } from "@/components/docs/kit";

export const metadata = { title: "Streaming" };

export default function Streaming() {
  return (
    <article>
      <DocTitle eyebrow="API reference" title={<>Streaming</>} lede="Set stream: true to receive the reply token by token as server-sent events, the same format the OpenAI API uses." />

      <h2>The event format</h2>
      <p>The response has <code>Content-Type: text/event-stream</code>. Each event is one line starting with <code>data: </code> followed by a JSON chunk. New text arrives in <code>choices[0].delta.content</code>:</p>
      <Code
        lang="text"
        code={`data: {"id":"gen-…","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"A bonding"}}]}

data: {"id":"gen-…","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" curve sets"}}]}

data: {"id":"gen-…","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"id":"gen-…","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":31,"completion_tokens":74,"total_tokens":105,"cost":0.000123}}

data: [DONE]`}
      />
      <ul>
        <li>The second-to-last chunk carries <code>usage</code>, including <code>cost</code>: the amount charged to your balance.</li>
        <li><code>data: [DONE]</code> marks the end of the stream.</li>
        <li>Lines starting with <code>:</code> are keep-alive comments. Ignore them.</li>
      </ul>

      <h2>Python</h2>
      <Code
        lang="python"
        code={`stream = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[{"role": "user", "content": "Write a haiku about block times."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
    if getattr(chunk, "usage", None):
        print("\\nCharged (USD):", chunk.usage.cost)`}
      />

      <h2>TypeScript</h2>
      <Code
        lang="typescript"
        code={`const stream = await client.chat.completions.create({
  model: "deepseek/deepseek-chat",
  messages: [{ role: "user", content: "Write a haiku about block times." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
  if (chunk.usage) console.log("\\nCharged (USD):", (chunk.usage as any).cost);
}`}
      />

      <h2>Plain fetch (no SDK)</h2>
      <Code
        lang="javascript"
        code={`const res = await fetch("${BASE}/chat/completions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.SYNAPS_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "deepseek/deepseek-chat",
    stream: true,
    messages: [{ role: "user", content: "gm" }],
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let i;
  while ((i = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    const chunk = JSON.parse(data);
    process.stdout.write(chunk.choices?.[0]?.delta?.content ?? "");
  }
}`}
      />

      <h2>Stopping early</h2>
      <p>You can close the connection at any time. The provider may already have generated more text than you received, and it bills for what it produced, so Synaps charges the final usage reported by the provider even after you disconnect.</p>
      <Callout kind="tip" title="Cap long replies">To limit the cost of a stream you might stop early, set <code>max_tokens</code> instead of relying on disconnecting.</Callout>

      <h2>Errors during a stream</h2>
      <p>If something fails before the first chunk, you get a normal JSON error with an HTTP status (see <a href="/docs/errors">Errors</a>). If the provider fails mid-stream, a chunk with an <code>error</code> object may arrive instead of more content; treat it as the end of the reply.</p>

      <Pager prev={{ href: "/docs/chat-completions", label: "Chat completions" }} next={{ href: "/docs/tools", label: "Tool calling & JSON" }} />
    </article>
  );
}

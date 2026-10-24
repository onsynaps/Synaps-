import { MARKUP_PCT, BASE, Callout, Code, DocTitle, Pager, Params } from "@/components/docs/kit";

export const metadata = { title: "Chat completions" };

export default function ChatCompletions() {
  return (
    <article>
      <DocTitle eyebrow="API reference" title={<>Chat completions</>} lede="Send a conversation, get the model's next message. Same request and response shape as the OpenAI Chat Completions API." />

      <Code lang="http" code={`POST ${BASE}/chat/completions`} />

      <h2>Request body</h2>
      <Params rows={[
        { name: "model", type: "string", required: true, desc: <>The model ID, for example <code>deepseek/deepseek-chat</code>. Must be one of the IDs returned by <a href="/docs/models"><code>GET /models</code></a>. Free models end in <code>:free</code>.</> },
        { name: "messages", type: "array", required: true, desc: <>The conversation so far, oldest first. Each item has a <code>role</code> (<code>system</code>, <code>user</code>, <code>assistant</code> or <code>tool</code>) and <code>content</code>. Assistant messages may carry <code>tool_calls</code>; tool messages carry <code>tool_call_id</code>.</> },
        { name: "stream", type: "boolean", desc: <>Default <code>false</code>. When <code>true</code>, the reply arrives as server-sent events. See <a href="/docs/streaming">Streaming</a>.</> },
        { name: "max_tokens", type: "integer", desc: <>Upper limit on generated tokens. Defaults to <code>4096</code> when omitted. Lower it to cap the cost of a single request.</> },
        { name: "temperature", type: "number", desc: <>Sampling temperature, usually between 0 and 2. Lower is more focused, higher is more varied.</> },
        { name: "top_p", type: "number", desc: <>Nucleus sampling. Use either this or <code>temperature</code>, not both.</> },
        { name: "stop", type: "string | string[]", desc: <>Up to four sequences where the model stops generating.</> },
        { name: "frequency_penalty", type: "number", desc: <>Penalises tokens that already appeared often. Range −2 to 2.</> },
        { name: "presence_penalty", type: "number", desc: <>Penalises tokens that already appeared at all. Range −2 to 2.</> },
        { name: "seed", type: "integer", desc: <>Best-effort determinism on models that support it.</> },
        { name: "tools", type: "array", desc: <>Functions the model may call. See <a href="/docs/tools">Tool calling</a>.</> },
        { name: "tool_choice", type: "string | object", desc: <><code>auto</code>, <code>none</code>, <code>required</code>, or a specific function.</> },
        { name: "response_format", type: "object", desc: <><code>{"{ \"type\": \"json_object\" }"}</code> or a JSON schema, on models that support structured output. See <a href="/docs/tools#json">JSON output</a>.</> },
        { name: "reasoning", type: "object", desc: <>Reasoning controls for thinking models, for example <code>{"{ \"effort\": \"high\" }"}</code>. Ignored by models that do not reason.</> },
      ]} />
      <Callout kind="note" title="Unlisted fields are dropped">Synaps forwards only the fields above. Anything else in the body is ignored, so provider-specific options cannot change routing or billing.</Callout>

      <h2>Example request</h2>
      <Code
        lang="bash"
        code={`curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-chat",
    "temperature": 0.3,
    "max_tokens": 300,
    "messages": [
      {"role": "system", "content": "Answer in one short paragraph."},
      {"role": "user", "content": "Why do tokens use bonding curves?"}
    ]
  }'`}
      />

      <h2>Response</h2>
      <Code
        lang="json"
        code={`{
  "id": "gen-1729760000-AbCdEf",
  "object": "chat.completion",
  "created": 1729760000,
  "model": "deepseek/deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A bonding curve sets the price from the supply..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 31,
    "completion_tokens": 74,
    "total_tokens": 105,
    "cost": 0.000123
  }
}`}
      />
      <Params rows={[
        { name: "choices[].message.content", type: "string | null", desc: <>The reply text. <code>null</code> when the model answered only with tool calls.</> },
        { name: "choices[].message.tool_calls", type: "array", desc: <>Present when the model wants to call one of your tools.</> },
        { name: "choices[].finish_reason", type: "string", desc: <><code>stop</code> (finished), <code>length</code> (hit <code>max_tokens</code>), <code>tool_calls</code>, or <code>content_filter</code>.</> },
        { name: "usage.prompt_tokens", type: "integer", desc: <>Tokens in your input, as counted by the provider.</> },
        { name: "usage.completion_tokens", type: "integer", desc: <>Tokens the model generated, including any reasoning tokens.</> },
        { name: "usage.cost", type: "number", desc: <><strong>What you were charged, in USD</strong>, including the Synaps fee. This amount was deducted from your balance. It is <code>0</code> for free models.</> },
      ]} />

      <h2>Multi-turn conversations</h2>
      <p>The API is stateless. To continue a conversation, send the full history every time, including the assistant&apos;s previous replies:</p>
      <Code
        lang="python"
        code={`history = [{"role": "user", "content": "Name a layer-2 chain."}]
first = client.chat.completions.create(model="deepseek/deepseek-chat", messages=history)
history.append({"role": "assistant", "content": first.choices[0].message.content})
history.append({"role": "user", "content": "Who runs it?"})
second = client.chat.completions.create(model="deepseek/deepseek-chat", messages=history)`}
      />
      <Callout kind="tip" title="Long histories cost more">Every message you resend counts as input tokens on each request. Trim or summarise old turns when a conversation grows.</Callout>

      <h2>Images</h2>
      <p>Models with vision accept image parts in a user message, using the OpenAI content-array format:</p>
      <Code
        lang="json"
        code={`{
  "role": "user",
  "content": [
    { "type": "text", "text": "What is in this chart?" },
    { "type": "image_url", "image_url": { "url": "https://example.com/chart.png" } }
  ]
}`}
      />
      <p>
        You can also send an image as a base64 data URL (<code>data:image/png;base64,…</code>). PNG, JPEG, WebP and GIF are accepted.
        Only models that list <code>image</code> in <code>input_modalities</code> on <a href="/docs/models">GET /models</a> can read images; sending one to a text-only model returns an error.
      </p>
      <Callout kind="tip" title="Keep images small">Requests are limited to about 4.5 MB. Resize photos to around 1600 px on the longest side before encoding; models see no extra detail beyond that anyway.</Callout>

      <h2>PDFs and documents</h2>
      <p>Send a PDF as a <code>file</code> part with a base64 data URL. It works with every model: models that read files natively get the PDF as is, and the rest receive its extracted text.</p>
      <Code
        lang="json"
        code={`{
  "role": "user",
  "content": [
    { "type": "text", "text": "Summarise the key terms in this contract." },
    { "type": "file", "file": { "filename": "contract.pdf", "file_data": "data:application/pdf;base64,JVBERi0x..." } }
  ]
}`}
      />
      <p>For plain text, Markdown, CSV, JSON or code files, put the contents straight into the text of the message. That is cheaper and works with any model.</p>
      <Callout kind="note" title="Scanned PDFs">Text extraction reads the text layer of a PDF. A scanned document with no text layer comes through empty on models without native file input; use a vision model, or send the pages as images.</Callout>

      <h2>Generating images</h2>
      <p>Models that list <code>image</code> in <code>output_modalities</code> can create images. Add <code>{`"modalities": ["image", "text"]`}</code> and send the request without streaming:</p>
      <Code
        lang="json"
        code={`{
  "model": "google/gemini-3.1-flash-image",
  "modalities": ["image", "text"],
  "messages": [{ "role": "user", "content": "A glass orb orbiting a violet planet, studio lighting" }]
}`}
      />
      <p>The images come back on the assistant message as base64 data URLs:</p>
      <Code
        lang="json"
        code={`{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Here is your image.",
      "images": [{ "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0..." } }]
    }
  }],
  "usage": { "prompt_tokens": 14, "completion_tokens": 1290, "cost": 0.0468 }
}`}
      />
      <p>You pay what the model charges for the image plus the usual {MARKUP_PCT}% fee, shown in <code>usage.cost</code>. Model IDs change over time, so pick a current one from <a href="/docs/models">GET /models</a>.</p>

      <Pager prev={{ href: "/docs/authentication", label: "Authentication" }} next={{ href: "/docs/streaming", label: "Streaming" }} />
    </article>
  );
}

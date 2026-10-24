import { BASE, Code, DocTitle, Pager, Params, MARKUP_PCT } from "@/components/docs/kit";

export const metadata = { title: "Models" };

export default function ModelsDoc() {
  return (
    <article>
      <DocTitle eyebrow="API reference" title={<>Models</>} lede="List every model you can call, with its context window, privacy lane and price." />

      <Code lang="http" code={`GET ${BASE}/models`} />
      <p>This endpoint is public and needs no key. The list refreshes about every 10 minutes from the routing provider, so new models appear without any change on your side.</p>

      <h2>Example</h2>
      <Code lang="bash" code={`curl ${BASE}/models`} />
      <p>The values below are illustrative. Call the endpoint for live prices.</p>
      <Code
        lang="json"
        code={`{
  "object": "list",
  "data": [
    {
      "id": "deepseek/deepseek-chat",
      "object": "model",
      "owned_by": "DeepSeek",
      "name": "DeepSeek V3",
      "context_length": 163840,
      "privacy_lane": "private",
      "input_modalities": ["text"],
      "output_modalities": ["text"],
      "pricing": {
        "prompt_per_million_usd": 0.36,
        "completion_per_million_usd": 1.06
      }
    }
  ]
}`}
      />

      <h2>Fields</h2>
      <Params rows={[
        { name: "id", type: "string", desc: <>Pass this exact value as <code>model</code> in a chat completion.</> },
        { name: "owned_by", type: "string", desc: <>The company that makes the model.</> },
        { name: "name", type: "string", desc: <>A readable name.</> },
        { name: "context_length", type: "integer", desc: <>Maximum tokens of input plus output the model accepts.</> },
        { name: "input_modalities", type: "string[]", desc: <>What the model can read: <code>text</code>, plus <code>image</code> for vision models and <code>file</code> for native PDF input. PDFs work on every model; see <a href="/docs/chat-completions">Chat completions</a>.</> },
        { name: "output_modalities", type: "string[]", desc: <>What the model can produce. Models with <code>image</code> can generate images.</> },
        { name: "privacy_lane", type: "string", desc: <><code>free</code>, <code>private</code> or <code>provider</code>. See <a href="/docs/privacy">Privacy lanes</a>.</> },
        { name: "pricing.prompt_per_million_usd", type: "number", desc: <>Price per million input tokens, <strong>including</strong> the {MARKUP_PCT}% Synaps fee.</> },
        { name: "pricing.completion_per_million_usd", type: "number", desc: <>Price per million output tokens, including the fee.</> },
      ]} />

      <h2>Which models are listed</h2>
      <p>Synaps lists text models from Anthropic, OpenAI, Google, DeepSeek, Qwen, Moonshot, Z.ai, xAI, Meta and Mistral, newest first, plus their free variants (IDs ending in <code>:free</code>). The full table with list prices is on the <a href="/app/models">Models page</a>.</p>

      <h2>Choosing a model</h2>
      <div className="dc-table">
        <table>
          <thead><tr><th>You need</th><th>Look for</th></tr></thead>
          <tbody>
            <tr><td>Lowest cost, high volume</td><td>DeepSeek, Qwen and small Gemini or GPT variants</td></tr>
            <tr><td>Hard reasoning and code</td><td>Top Claude, GPT and Gemini models</td></tr>
            <tr><td>Very long documents</td><td>Models with a context length of 1M tokens</td></tr>
            <tr><td>Prompts not stored or trained on</td><td>Any model with the <code>private</code> lane</td></tr>
            <tr><td>Testing for free</td><td>IDs ending in <code>:free</code></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Fetching the list in code</h2>
      <Code
        lang="python"
        code={`import requests
models = requests.get("${BASE}/models").json()["data"]
cheap = sorted(models, key=lambda m: m["pricing"]["completion_per_million_usd"])[:5]
for m in cheap:
    print(m["id"], m["pricing"]["completion_per_million_usd"])`}
      />

      <Pager prev={{ href: "/docs/tools", label: "Tool calling & JSON" }} next={{ href: "/docs/billing", label: "Billing & pricing" }} />
    </article>
  );
}

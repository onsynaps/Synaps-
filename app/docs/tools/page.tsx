import { Callout, Code, DocTitle, Pager } from "@/components/docs/kit";

export const metadata = { title: "Tool calling & JSON" };

export default function Tools() {
  return (
    <article>
      <DocTitle eyebrow="API reference" title={<>Tool calling <span className="serif">&amp; JSON.</span></>} lede="Let a model call your functions, or force it to answer in JSON you can parse." />

      <h2>How tool calling works</h2>
      <ol>
        <li>You describe your functions in <code>tools</code>, each with a JSON Schema for its arguments.</li>
        <li>The model either answers normally or returns <code>tool_calls</code> with the function name and arguments.</li>
        <li>You run the function yourself and send the result back as a <code>tool</code> message.</li>
        <li>The model uses that result to write its final answer.</li>
      </ol>
      <p>Synaps never runs your functions. It only passes the definitions and calls between you and the model.</p>

      <h2>Full example</h2>
      <Code
        lang="python"
        code={`import json

tools = [{
    "type": "function",
    "function": {
        "name": "get_token_price",
        "description": "Get the current USD price of a token by its ticker.",
        "parameters": {
            "type": "object",
            "properties": {"ticker": {"type": "string", "description": "e.g. ETH"}},
            "required": ["ticker"],
        },
    },
}]

messages = [{"role": "user", "content": "What's ETH trading at?"}]
first = client.chat.completions.create(
    model="deepseek/deepseek-chat", messages=messages, tools=tools,
)

call = first.choices[0].message.tool_calls[0]
args = json.loads(call.function.arguments)
price = {"ticker": args["ticker"], "usd": 3120.55}  # your own lookup

messages.append(first.choices[0].message)
messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(price)})

final = client.chat.completions.create(
    model="deepseek/deepseek-chat", messages=messages, tools=tools,
)
print(final.choices[0].message.content)`}
      />

      <h2>Controlling tool use</h2>
      <ul>
        <li><code>"tool_choice": "auto"</code> (default): the model decides.</li>
        <li><code>"tool_choice": "none"</code>: never call a tool.</li>
        <li><code>"tool_choice": "required"</code>: must call at least one tool.</li>
        <li><code>{`{"type": "function", "function": {"name": "get_token_price"}}`}</code>: must call that function.</li>
      </ul>
      <Callout kind="note" title="Model support varies">Most current models from Anthropic, OpenAI, Google, DeepSeek and Qwen support tools. Some smaller or free models do not and will answer in plain text instead.</Callout>

      <h2 id="json">JSON output</h2>
      <h3>JSON mode</h3>
      <p>Ask for any valid JSON object. Say in the prompt what fields you want:</p>
      <Code
        lang="python"
        code={`reply = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    response_format={"type": "json_object"},
    messages=[{"role": "user", "content": "Give me {\\"name\\": str, \\"chain\\": str} for Uniswap."}],
)
data = json.loads(reply.choices[0].message.content)`}
      />
      <h3>JSON schema</h3>
      <p>On models that support structured outputs, pass a schema and the reply will match it:</p>
      <Code
        lang="json"
        code={`"response_format": {
  "type": "json_schema",
  "json_schema": {
    "name": "token",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "chain": { "type": "string" },
        "launched": { "type": "boolean" }
      },
      "required": ["name", "chain", "launched"],
      "additionalProperties": false
    }
  }
}`}
      />
      <Callout kind="tip" title="Always validate">Even with a schema, parse the reply inside a try/except and validate it before you trust it.</Callout>

      <Pager prev={{ href: "/docs/streaming", label: "Streaming" }} next={{ href: "/docs/models", label: "Models" }} />
    </article>
  );
}

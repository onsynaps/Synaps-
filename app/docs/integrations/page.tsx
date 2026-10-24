import { BASE, Callout, Code, DocTitle, Pager } from "@/components/docs/kit";

export const metadata = { title: "Integrations" };

export default function Integrations() {
  return (
    <article>
      <DocTitle eyebrow="Guides" title={<>Integrations</>} lede="Anything that speaks the OpenAI API can use Synaps. Set the base URL and the key, and keep the rest of your setup." />

      <p>The two values every integration needs:</p>
      <div className="dc-table">
        <table>
          <tbody>
            <tr><td>Base URL</td><td><code style={{ wordBreak: "break-all" }}>{BASE}</code></td></tr>
            <tr><td>API key</td><td>Your <code>syn_…</code> key from <a href="/app/keys">API keys</a></td></tr>
          </tbody>
        </table>
      </div>

      <h2>OpenAI SDK (Python)</h2>
      <Code lang="python" code={`from openai import OpenAI
client = OpenAI(base_url="${BASE}", api_key="syn_...")`} />
      <p>Or with environment variables, so existing code needs no change at all:</p>
      <Code lang="bash" code={`export OPENAI_BASE_URL="${BASE}"
export OPENAI_API_KEY="syn_..."`} />

      <h2>OpenAI SDK (Node.js)</h2>
      <Code lang="typescript" code={`import OpenAI from "openai";
const client = new OpenAI({ baseURL: "${BASE}", apiKey: process.env.SYNAPS_API_KEY });`} />

      <h2>Vercel AI SDK</h2>
      <Code lang="bash" code="npm install ai @ai-sdk/openai" />
      <Code lang="typescript" code={`import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const synaps = createOpenAI({
  baseURL: "${BASE}",
  apiKey: process.env.SYNAPS_API_KEY,
});

const result = streamText({
  model: synaps.chat("deepseek/deepseek-chat"),
  prompt: "Summarise this changelog in three bullets.",
});

for await (const text of result.textStream) process.stdout.write(text);`} />

      <h2>LangChain</h2>
      <Code lang="bash" code="pip install langchain-openai" />
      <Code lang="python" code={`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="deepseek/deepseek-chat",
    base_url="${BASE}",
    api_key="syn_...",
)
print(llm.invoke("Explain gas fees to a five-year-old.").content)`} />

      <h2>LlamaIndex</h2>
      <Code lang="python" code={`from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    model="deepseek/deepseek-chat",
    api_base="${BASE}",
    api_key="syn_...",
    is_chat_model=True,
)`} />

      <h2>Coding tools and chat apps</h2>
      <p>Tools that let you add a custom OpenAI-compatible provider work the same way. Look for a setting named like <em>OpenAI base URL</em>, <em>custom endpoint</em> or <em>OpenAI-compatible provider</em>:</p>
      <ul>
        <li><strong>Cursor:</strong> Settings → Models → OpenAI API key, then override the base URL with the Synaps URL and add model IDs by name.</li>
        <li><strong>Continue, Cline, Roo Code:</strong> choose the <em>OpenAI compatible</em> provider and enter the base URL, key and model ID.</li>
        <li><strong>Open WebUI, LibreChat, Chatbox:</strong> add an OpenAI-compatible connection with the same values.</li>
      </ul>
      <Callout kind="note" title="OpenAI format only">Synaps speaks the OpenAI Chat Completions format. Tools that only speak Anthropic&apos;s Messages format natively cannot connect directly yet.</Callout>

      <h2>Bots and backends</h2>
      <p>For a Telegram or Discord bot, call Synaps from your server, never from the client, and give the bot its own key with a daily limit. That way a spike in users can never spend more than you planned.</p>

      <Pager prev={{ href: "/docs/privacy", label: "Privacy lanes" }} next={{ href: "/docs/faq", label: "FAQ" }} />
    </article>
  );
}

import { env } from "./env";

export type Lane = "free" | "private" | "provider";

export type Model = {
  id: string;
  name: string;
  maker: string;
  context: number;
  promptPrice: number; // USD per token, with Synaps markup
  completionPrice: number; // USD per token, with Synaps markup
  listPromptPrice: number; // USD per token, OpenRouter list
  listCompletionPrice: number;
  lane: Lane;
  free: boolean;
};

const MAKERS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  moonshotai: "Moonshot",
  "z-ai": "Z.ai",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  mistralai: "Mistral",
};
const CLOSED = ["anthropic/", "x-ai/", "google/gemini", "openai/gpt-", "openai/o"];
const PER_MAKER = 8;

let cache: { at: number; models: Model[] } | null = null;

function laneOf(id: string, free: boolean): Lane {
  if (free) return "free";
  if (id.startsWith("openai/gpt-oss")) return "private";
  if (CLOSED.some((p) => id.startsWith(p))) return "provider";
  return "private";
}

export async function getModels(): Promise<Model[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.models;
  const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 600 } });
  if (!res.ok) throw new Error("Could not load models from OpenRouter.");
  const json = (await res.json()) as { data: any[] };
  const k = 1 + env.markup;
  const counts: Record<string, number> = {};
  const out: Model[] = [];
  const sorted = [...json.data].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  for (const m of sorted) {
    const id: string = m.id;
    const maker = id.split("/")[0];
    const free = id.endsWith(":free");
    // paid models: only the big makers; free models: any maker, so free traffic can fall back across providers
    if (!MAKERS[maker] && !free) continue;
    const makerName = MAKERS[maker] || maker.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    if (id.includes(":") && !free) continue;
    const modality: string = m.architecture?.modality ?? "text->text";
    if (!modality.endsWith("->text")) continue;
    const p = Number(m.pricing?.prompt ?? 0);
    const c = Number(m.pricing?.completion ?? 0);
    if (!free && (p < 0 || c < 0 || (p === 0 && c === 0))) continue;
    const bucket = free ? "free" : maker;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    if (counts[bucket] > (free ? 12 : PER_MAKER)) continue;
    out.push({
      id,
      name: String(m.name ?? id).replace(/^[^:]+:\s*/, ""),
      maker: makerName,
      context: Number(m.context_length ?? 0),
      listPromptPrice: p,
      listCompletionPrice: c,
      promptPrice: free ? 0 : p * k,
      completionPrice: free ? 0 : c * k,
      lane: laneOf(id, free),
      free,
    });
  }
  cache = { at: Date.now(), models: out };
  return out;
}

export async function findModel(id: string): Promise<Model | undefined> {
  return (await getModels()).find((m) => m.id === id);
}

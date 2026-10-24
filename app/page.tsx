import Landing, { type CardModel, type Receipt } from "@/components/landing/Landing";
import { getToken } from "@/lib/token";
import { getModels, type Model } from "@/lib/models";
import { env } from "@/lib/env";
import { perMillion } from "@/lib/money";

export const revalidate = 600;
export const metadata = { alternates: { canonical: "/" } };

const WANT: { maker: string; match?: RegExp; free?: boolean }[] = [
  { maker: "OpenAI", match: /gpt-oss/, free: true },
  { maker: "DeepSeek" },
  { maker: "Anthropic", match: /sonnet/i },
  { maker: "OpenAI", match: /gpt-(?!oss)/ },
  { maker: "Google", match: /gemini/i },
  { maker: "Qwen" },
  { maker: "Moonshot" },
  { maker: "xAI" },
];

function pick(models: Model[]): Model[] {
  const out: Model[] = [];
  for (const w of WANT) {
    const m = models.find(
      (x) => x.maker === w.maker && (w.free === undefined ? !x.free : x.free === w.free) && (!w.match || w.match.test(x.id)) && !out.includes(x)
    );
    if (m) out.push(m);
  }
  return out;
}

export default async function Page() {
  const token = await getToken();
  let models: Model[] = [];
  try {
    models = await getModels();
  } catch {}
  const picked = pick(models);
  const cards: CardModel[] = picked.map((m) => ({
    id: m.id,
    name: m.name,
    maker: m.maker,
    context: m.context,
    lane: m.lane,
    outPerM: perMillion(m.completionPrice),
  }));

  const sonnet = picked.find((m) => m.maker === "Anthropic");
  const M = 2;
  const receipt: Receipt = sonnet
    ? {
        model: sonnet.name,
        outTokensM: M,
        list: "$" + (sonnet.listCompletionPrice * 1e6 * M).toFixed(2),
        ours: "$" + (sonnet.completionPrice * 1e6 * M).toFixed(2),
      }
    : null;

  return <Landing cards={cards} receipt={receipt} markupPct={Math.round(env.markup * 100)} apiBase={env.siteUrl.replace(/\/$/, "") + "/api/v1"} token={token ? { address: token.address, symbol: token.symbol, bonusPct: Math.round(env.synapsBonus * 100) } : null} />;
}

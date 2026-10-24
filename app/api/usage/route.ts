import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const [{ data: usage }, { data: topups }] = await Promise.all([
    db().from("syn_usage").select("id,source,model,prompt_tokens,completion_tokens,charged_micros,created_at,key_id").eq("address", address).order("created_at", { ascending: false }).limit(30),
    db().from("syn_topups").select("tx_hash,chain,asset,amount_raw,usd_micros,created_at").eq("address", address).order("created_at", { ascending: false }).limit(20),
  ]);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const today = (usage ?? []).filter((u) => new Date(u.created_at) >= since);
  return Response.json({
    usage: usage ?? [],
    topups: topups ?? [],
    today: {
      messages: today.length,
      spent_micros: today.reduce((s, u) => s + Number(u.charged_micros || 0), 0),
    },
  });
}

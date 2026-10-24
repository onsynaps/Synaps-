import { ethUsd } from "@/lib/price";
import { getToken } from "@/lib/token";
import { synapsUsd } from "@/lib/synaps-price";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let eth: number | null = null;
  try { eth = await ethUsd(); } catch {}
  let synaps: { address: string; usd: number; decimals: number; bonus: number; bonus_cap_usd: number } | null = null;
  try {
    const token = await getToken();
    if (token) {
      const p = await synapsUsd(token);
      if (p) synaps = { address: token.address, usd: p.usd, decimals: p.decimals, bonus: env.synapsBonus, bonus_cap_usd: env.synapsBonusCapUsd };
    }
  } catch {}
  if (eth == null && !synaps) return Response.json({ error: { message: "Could not load prices." } }, { status: 502 });
  return Response.json({ eth_usd: eth, synaps });
}

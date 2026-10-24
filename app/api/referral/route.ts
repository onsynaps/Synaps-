import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SITE } from "@/lib/seo";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Your invite link and what it has earned. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const [code, stats] = await Promise.all([
    db().rpc("syn_ref_code", { p_address: address }),
    db().rpc("syn_referral_stats", { p_address: address }),
  ]);
  if (code.error || !code.data) return bad("Could not load your invite link.", 500);
  const s = (stats.data ?? {}) as any;
  return Response.json({
    code: code.data,
    link: `${SITE}/?ref=${code.data}`,
    invited: Number(s.invited ?? 0),
    converted: Number(s.converted ?? 0),
    earned_micros: Number(s.earned_micros ?? 0),
    you_were_invited: Boolean(s.referred_by),
    your_bonus_used: Boolean(s.rewarded),
    terms: {
      referrer_pct: env.refReferrerPct,
      referee_pct: env.refRefereePct,
      cap_usd: env.refCapUsd,
      min_usd: env.refMinUsd,
    },
  });
}

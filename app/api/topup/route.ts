import { createPublicClient, http, parseAbiItem, decodeEventLog, type Hash } from "viem";
import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CHAINS, USDC_BASE, type ChainKey } from "@/lib/chains";
import { ethUsd } from "@/lib/price";
import { bad } from "@/lib/http";
import { getToken } from "@/lib/token";
import { synapsUsd, bonusFor } from "@/lib/synaps-price";

export const runtime = "nodejs";
export const maxDuration = 60;

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  if (!env.treasury) return bad("Top-ups are not open yet.", 503);

  const { txHash, chain } = await req.json().catch(() => ({}));
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return bad("That transaction hash is not valid.");
  if (!(chain in CHAINS)) return bad("Unsupported network.");
  const c = CHAINS[chain as ChainKey];

  const client = createPublicClient({ transport: http(chain === "base" ? env.baseRpc : env.rhRpc) });
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash as Hash, timeout: 45_000, confirmations: 1 });
  } catch {
    return bad("The transaction is not confirmed yet. Wait a moment and try again.", 409);
  }
  if (receipt.status !== "success") return bad("This transaction failed on-chain, so nothing was credited.");

  const tx = await client.getTransaction({ hash: txHash as Hash });
  if (tx.from.toLowerCase() !== address) return bad("This transaction was not sent from your connected wallet.", 403);

  let asset = "ETH";
  let amountRaw = 0n;
  let usdMicros = 0;
  let bonusMicros = 0;
  const token = chain === "robinhood" ? await getToken() : null;

  if (tx.to?.toLowerCase() === env.treasury && tx.value > 0n) {
    amountRaw = tx.value;
    const price = await ethUsd();
    usdMicros = Math.floor((Number(amountRaw) / 1e18) * price * 1e6);
  } else if (chain === "base" && tx.to?.toLowerCase() === USDC_BASE) {
    asset = "USDC";
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC_BASE) continue;
      try {
        const ev = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
        if (ev.args.from.toLowerCase() === address && ev.args.to.toLowerCase() === env.treasury) amountRaw += ev.args.value;
      } catch {}
    }
    usdMicros = Number(amountRaw); // USDC has 6 decimals, same as micros
  } else if (token && tx.to?.toLowerCase() === token.address.toLowerCase()) {
    asset = "SYNAPS";
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== token.address.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
        if (ev.args.from.toLowerCase() === address && ev.args.to.toLowerCase() === env.treasury) amountRaw += ev.args.value;
      } catch {}
    }
    let price;
    try {
      price = await synapsUsd(token);
    } catch {}
    if (!price) return bad("Could not price $SYNAPS right now. Your tokens are safe; press Check again in a minute.", 409);
    usdMicros = Math.floor((Number(amountRaw) / 10 ** price.decimals) * price.usd * 1e6);
    bonusMicros = bonusFor(usdMicros);
  } else {
    return bad(`This transaction did not pay the Synaps treasury on ${c.name}.`);
  }

  if (usdMicros < 500_000) return bad("Top-ups start at $0.50.");

  const { data: credited, error } = await db().rpc("syn_apply_topup_bonus", {
    p_tx: txHash,
    p_chain: chain,
    p_address: address,
    p_asset: asset,
    p_amount_raw: amountRaw.toString(),
    p_usd: usdMicros,
    p_bonus: bonusMicros,
  });
  if (error) return bad("Could not credit this top-up. Contact support with your transaction hash.", 500);
  if (!credited) return bad("This transaction was already credited.", 409);

  // invited wallets: on the first qualifying top-up, both the inviter and this wallet get bonus credit (once)
  let referralMicros = 0;
  try {
    const { data: ref } = await db().rpc("syn_referral_reward", {
      p_address: address,
      p_tx: txHash,
      p_usd: usdMicros,
      p_referrer_pct: env.refReferrerPct,
      p_referee_pct: env.refRefereePct,
      p_cap: Math.round(env.refCapUsd * 1e6),
      p_min: Math.round(env.refMinUsd * 1e6),
    });
    referralMicros = Number((ref as any)?.referee_micros ?? 0);
  } catch {}

  const { data: user } = await db().from("syn_users").select("balance_micros").eq("address", address).single();
  return Response.json({
    credited_micros: usdMicros + bonusMicros + referralMicros,
    bonus_micros: bonusMicros,
    referral_micros: referralMicros,
    balance_micros: user?.balance_micros ?? 0,
  });
}

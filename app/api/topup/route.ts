import { createPublicClient, http, parseAbiItem, decodeEventLog, type Hash } from "viem";
import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CHAINS, USDC_BASE, type ChainKey } from "@/lib/chains";
import { ethUsd } from "@/lib/price";
import { bad } from "@/lib/http";

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
  } else {
    return bad(`This transaction did not pay the Synaps treasury on ${c.name}.`);
  }

  if (usdMicros < 500_000) return bad("Top-ups start at $0.50.");

  const { data: credited, error } = await db().rpc("syn_apply_topup", {
    p_tx: txHash,
    p_chain: chain,
    p_address: address,
    p_asset: asset,
    p_amount_raw: amountRaw.toString(),
    p_usd: usdMicros,
  });
  if (error) return bad("Could not credit this top-up. Contact support with your transaction hash.", 500);
  if (!credited) return bad("This transaction was already credited.", 409);

  const { data: user } = await db().from("syn_users").select("balance_micros").eq("address", address).single();
  return Response.json({ credited_micros: usdMicros, balance_micros: user?.balance_micros ?? 0 });
}

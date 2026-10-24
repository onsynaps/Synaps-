import { getToken } from "@/lib/token";
import { getBurns } from "@/lib/burns";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 120;

/** Public: the $SYNAPS contract once the treasury wallet has launched it on Pons, plus dev burns. */
export async function GET() {
  const token = await getToken();
  const burns = token ? await getBurns(token) : null;
  return Response.json({
    live: Boolean(token),
    token: token ? { address: token.address, symbol: token.symbol, name: token.name, chain: "robinhood", chain_id: 4663, launch_tx: token.txHash ?? null } : null,
    burns,
    treasury: env.treasury || null,
  });
}

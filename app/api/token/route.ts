import { getToken } from "@/lib/token";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const revalidate = 120;

/** Public: the $SYNAPS contract once the treasury wallet has launched it on Pons, otherwise null. */
export async function GET() {
  const token = await getToken();
  return Response.json({
    live: Boolean(token),
    token: token ? { address: token.address, symbol: token.symbol, name: token.name, chain: "robinhood", chain_id: 4663, launch_tx: token.txHash ?? null } : null,
    treasury: env.treasury || null,
  });
}

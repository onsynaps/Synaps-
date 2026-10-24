import { getSessionAddress } from "@/lib/session";
import { getUser } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getSessionAddress();
  const base = { treasury: env.treasury, freeDailyLimit: env.freeDailyLimit, markup: env.markup };
  if (!address) return Response.json({ address: null, balance_micros: 0, ...base });
  const user = await getUser(address).catch(() => null);
  return Response.json({ address, balance_micros: user?.balance_micros ?? 0, ...base });
}

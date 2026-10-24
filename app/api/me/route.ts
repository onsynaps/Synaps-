import { cookies } from "next/headers";
import { getSessionAddress } from "@/lib/session";
import { getUser, db, freeLeft } from "@/lib/db";
import { env } from "@/lib/env";
import { freeKeys } from "@/lib/free";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = await getSessionAddress();
  const f = freeKeys(req);
  const left = await freeLeft(f.keys.slice(0, -1), f.limits.slice(0, -1)).catch(() => null);
  const base = { treasury: env.treasury, freeDailyLimit: env.freeDailyLimit, freeLeft: left, markup: env.markup };
  if (!address) return Response.json({ address: null, balance_micros: 0, ...base });

  // an invite link was opened before signing in: link this wallet to the inviter (only before its first top-up)
  const jar = await cookies();
  const ref = jar.get("syn_ref")?.value;
  if (ref && /^[a-z0-9]{6,12}$/.test(ref)) {
    await db().rpc("syn_set_referrer", { p_address: address, p_code: ref }).then(() => null, () => null);
    jar.delete("syn_ref");
  }

  const user = await getUser(address).catch(() => null);
  return Response.json({ address, balance_micros: user?.balance_micros ?? 0, isAdmin: env.adminAddresses.includes(address.toLowerCase()), ...base });
}

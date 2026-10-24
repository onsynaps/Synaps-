import { getSessionAddress } from "@/lib/session";
import { db, ensureUser } from "@/lib/db";
import { newKey } from "@/lib/apikey";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { data: keys } = await db()
    .from("syn_api_keys")
    .select("id,name,prefix,daily_limit_micros,created_at")
    .eq("address", address)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: usage } = await db()
    .from("syn_usage")
    .select("key_id,charged_micros")
    .eq("address", address)
    .not("key_id", "is", null)
    .gte("created_at", since);
  const spent: Record<string, number> = {};
  for (const u of usage ?? []) spent[u.key_id] = (spent[u.key_id] ?? 0) + Number(u.charged_micros || 0);
  return Response.json({ keys: (keys ?? []).map((k) => ({ ...k, spent_7d_micros: spent[k.id] ?? 0 })) });
}

export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { name, daily_limit_usd } = await req.json().catch(() => ({}));
  const label = String(name || "").trim().slice(0, 40) || "default";
  const limit = Number(daily_limit_usd);
  const { count } = await db().from("syn_api_keys").select("id", { count: "exact", head: true }).eq("address", address).is("revoked_at", null);
  if ((count ?? 0) >= 10) return bad("You can have up to 10 active keys. Revoke one first.");
  await ensureUser(address);
  const k = newKey();
  const { data, error } = await db()
    .from("syn_api_keys")
    .insert({
      address,
      name: label,
      prefix: k.prefix,
      key_hash: k.hash,
      daily_limit_micros: Number.isFinite(limit) && limit > 0 ? Math.round(limit * 1e6) : null,
    })
    .select("id,name,prefix,daily_limit_micros,created_at")
    .single();
  if (error) return bad("Could not create the key.", 500);
  return Response.json({ key: { ...data, spent_7d_micros: 0 }, secret: k.secret });
}

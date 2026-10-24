import { createHash, randomBytes } from "crypto";
import { db } from "./db";

export function newKey() {
  const secret = "syn_" + randomBytes(24).toString("hex");
  return { secret, prefix: secret.slice(0, 12), hash: hashKey(secret) };
}

export function hashKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function authKey(req: Request): Promise<{ address: string; keyId: string; dailyLimit: number | null } | null> {
  const h = req.headers.get("authorization") || "";
  const secret = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : req.headers.get("x-api-key") || "";
  if (!secret.startsWith("syn_")) return null;
  const { data } = await db()
    .from("syn_api_keys")
    .select("id,address,daily_limit_micros,revoked_at")
    .eq("key_hash", hashKey(secret))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return { address: data.address, keyId: data.id, dailyLimit: data.daily_limit_micros };
}

export async function spentToday(keyId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await db()
    .from("syn_usage")
    .select("charged_micros")
    .eq("key_id", keyId)
    .gte("created_at", since.toISOString());
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.charged_micros || 0), 0);
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      throw new Error("Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    }
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function ensureUser(address: string) {
  await db().from("syn_users").upsert({ address }, { onConflict: "address", ignoreDuplicates: true });
}

export async function getUser(address: string) {
  const { data } = await db().from("syn_users").select("address,balance_micros").eq("address", address).maybeSingle();
  return data as { address: string; balance_micros: number } | null;
}

export async function debit(address: string, micros: number): Promise<number | null> {
  const { data, error } = await db().rpc("syn_debit", { p_address: address, p_amount: micros });
  if (error) throw error;
  return data as number | null;
}

export async function logUsage(row: {
  address: string;
  key_id?: string | null;
  source: "chat" | "api";
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_micros: number;
  charged_micros: number;
}) {
  await db().from("syn_usage").insert(row);
}

export async function takeFree(ip: string, limit: number): Promise<boolean> {
  const { data, error } = await db().rpc("syn_take_free", { p_ip: ip, p_limit: limit });
  if (error) throw error;
  return Boolean(data);
}

/** Fixed-window rate limit. Returns true when allowed. Fails open if the database is unreachable. */
export async function rateHit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await db().rpc("syn_rate_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) return true;
    return Boolean(data);
  } catch {
    return true;
  }
}

/** Checks several daily free counters at once. Returns 0 when allowed (and counts it), else the 1-based index of the limit that was hit. */
export async function takeFreeMulti(keys: string[], limits: number[]): Promise<number> {
  const { data, error } = await db().rpc("syn_take_free_multi", { p_keys: keys, p_limits: limits });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function freeLeft(keys: string[], limits: number[]): Promise<number> {
  const { data } = await db().rpc("syn_free_left", { p_keys: keys, p_limits: limits });
  return Number(data ?? 0);
}

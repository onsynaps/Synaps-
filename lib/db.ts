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

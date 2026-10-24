import { getSessionAddress } from "@/lib/session";
import { findModel } from "@/lib/models";
import { getUser, takeFree } from "@/lib/db";
import { relay } from "@/lib/relay";
import { env, missingEnv } from "@/lib/env";
import { bad, clientIp } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!env.openrouterKey) return bad("The model router is not configured yet.", 503);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.model !== "string" || !Array.isArray(body.messages)) return bad("Send a model and messages.");
  const messages = body.messages
    .filter((m: any) => m && typeof m.content === "string" && ["user", "assistant", "system"].includes(m.role))
    .slice(-40);
  if (!messages.length) return bad("Write a message first.");

  const model = await findModel(body.model);
  if (!model) return bad("That model is not available.");

  const address = await getSessionAddress();

  if (model.free) {
    if (missingEnv().includes("SUPABASE_URL")) return bad("The database is not configured yet.", 503);
    const allowed = await takeFree(clientIp(req), env.freeDailyLimit);
    if (!allowed) return bad(`You've used today's ${env.freeDailyLimit} free messages. Connect a wallet to keep going with paid models.`, 429);
  } else {
    if (!address) return bad("Connect your wallet to use this model.", 401);
    const user = await getUser(address);
    if (!user || user.balance_micros < env.minBalanceMicros) return bad("Your balance is too low. Top up to keep chatting.", 402);
  }

  return relay({
    body: { messages, stream: true, max_tokens: Math.min(Number(body.max_tokens) || 4096, 8192) },
    model,
    who: address ? { address, source: "chat" } : null,
    injectSynapsEvent: true,
  });
}

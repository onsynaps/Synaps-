import { authKey, spentToday } from "@/lib/apikey";
import { findModel } from "@/lib/models";
import { getUser, rateHit, takeFreeMulti } from "@/lib/db";
import { relay } from "@/lib/relay";
import { env } from "@/lib/env";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const key = await authKey(req);
  if (!key) return bad("Missing or invalid API key. Send it as: Authorization: Bearer syn_...", 401);
  if (!env.openrouterKey) return bad("The model router is not configured yet.", 503);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.model !== "string" || !Array.isArray(body.messages)) return bad("Send a model and messages.");
  const model = await findModel(body.model);
  if (!model) return bad(`Model "${body.model}" is not available. GET /api/v1/models lists every model.`, 404);

  if (!(await rateHit("api:" + key.keyId, 60, 60))) {
    return bad("Rate limit: 60 requests per minute per key. Slow down and retry.", 429);
  }
  if (model.free) {
    const hit = await takeFreeMulti(["key:" + key.keyId, "global"], [env.freeDailyLimit * 5, env.freeGlobalLimit]);
    if (hit === 1) return bad(`This key used today's ${env.freeDailyLimit * 5} free-model requests. Use a paid model or try again tomorrow.`, 429);
    if (hit === 2) return bad("Free models have reached today's limit for everyone. Use a paid model or try again tomorrow.", 429);
  }

  if (!model.free) {
    const user = await getUser(key.address);
    if (!user || user.balance_micros < env.minBalanceMicros) return bad("Insufficient balance. Top up at /app/wallet.", 402);
    if (key.dailyLimit != null && (await spentToday(key.keyId)) >= key.dailyLimit) {
      return bad("This key reached its daily spending limit.", 429);
    }
  }

  // forward only standard OpenAI fields
  const allowed = [
    "messages", "stream", "max_tokens", "temperature", "top_p", "stop", "tools", "tool_choice",
    "response_format", "seed", "frequency_penalty", "presence_penalty", "reasoning", "modalities",
  ];
  const clean: Record<string, any> = {};
  for (const k of allowed) if (body[k] !== undefined) clean[k] = body[k];

  return relay({ body: clean, model, who: { address: key.address, keyId: key.keyId, source: "api" } });
}

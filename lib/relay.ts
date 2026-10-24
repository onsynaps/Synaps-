import { after } from "next/server";
import { env } from "./env";
import { debit, logUsage } from "./db";
import type { Model } from "./models";

type Who = { address: string; keyId?: string | null; source: "chat" | "api" } | null;

type RelayOpts = {
  body: Record<string, any>;
  model: Model;
  who: Who; // null = anonymous free usage
  injectSynapsEvent?: boolean; // add a final SSE event with the charge (in-app chat only)
  fallbacks?: string[]; // other model IDs OpenRouter may try if the first one fails
  surchargeMicros?: number; // flat extra charge, e.g. web search
};

/** Turns an OpenRouter error object into a message a person can act on. */
export function describeError(err: any, status?: number): string {
  const code = Number(err?.code ?? status ?? 0);
  let raw = err?.metadata?.raw;
  if (raw && typeof raw !== "string") {
    try { raw = JSON.stringify(raw); } catch { raw = ""; }
  }
  const detail = typeof raw === "string" ? raw.replace(/\s+/g, " ").slice(0, 180) : "";
  const providerName = err?.metadata?.provider_name ? ` (${err.metadata.provider_name})` : "";
  if (code === 429) return `This model is busy right now${providerName}. Try again in a minute or pick another model.`;
  if (code === 402) return "The model router is out of credit. The Synaps team has been notified; please try again later.";
  if (code === 404 && /data policy/i.test(String(err?.message))) return "No provider for this model matches the privacy settings. Pick another model.";
  const base = String(err?.message || "The model provider returned an error.");
  return detail && !base.includes(detail) ? `${base}${providerName}: ${detail}` : base + providerName;
}

function chargeFor(model: Model, usage: any, surcharge = 0): { cost: number; charged: number; pt: number; ct: number } {
  const pt = Number(usage?.prompt_tokens ?? 0);
  const ct = Number(usage?.completion_tokens ?? 0);
  if (model.free) return { cost: 0, charged: 0, pt, ct };
  let costUsd = Number(usage?.cost);
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    costUsd = pt * model.listPromptPrice + ct * model.listCompletionPrice;
  }
  const cost = Math.ceil(costUsd * 1_000_000);
  const charged = Math.ceil(costUsd * (1 + env.markup) * 1_000_000) + Math.max(0, Math.round(surcharge));
  return { cost, charged, pt, ct };
}

async function settle(who: Who, model: Model, usage: any, surcharge = 0) {
  const c = chargeFor(model, usage, surcharge);
  let balance: number | null = null;
  if (who) {
    if (c.charged > 0) balance = await debit(who.address, c.charged);
    await logUsage({
      address: who.address,
      key_id: who.keyId ?? null,
      source: who.source,
      model: model.id,
      prompt_tokens: c.pt,
      completion_tokens: c.ct,
      cost_micros: c.cost,
      charged_micros: c.charged,
    }).catch(() => {});
  }
  return { ...c, balance };
}

export async function relay({ body, model, who, injectSynapsEvent, fallbacks, surchargeMicros = 0 }: RelayOpts): Promise<Response> {
  const stream = Boolean(body.stream);
  const payload: Record<string, any> = {
    ...body,
    model: model.id,
    stream,
    usage: { include: true },
  };
  if (!model.free) payload.provider = { ...(body.provider ?? {}), data_collection: "deny" };
  if (payload.max_tokens == null) payload.max_tokens = 4096;
  if (fallbacks?.length) payload.models = [model.id, ...fallbacks.filter((f) => f !== model.id)].slice(0, 3);

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.siteUrl,
      "X-Title": "Synaps",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    let err: any = null;
    try { err = JSON.parse(text)?.error; } catch {}
    console.error("[relay] upstream error", upstream.status, model.id, text.slice(0, 500));
    const message = describeError(err, upstream.status);
    return Response.json({ error: { message, code: upstream.status } }, { status: upstream.status || 502 });
  }

  if (!stream) {
    const json = await upstream.json();
    if (json?.error) {
      console.error("[relay] error in body", model.id, JSON.stringify(json.error).slice(0, 500));
      return Response.json({ error: { message: describeError(json.error), code: json.error.code } }, { status: Number(json.error.code) || 502 });
    }
    const s = await settle(who, model, json.usage, surchargeMicros);
    if (json.usage) json.usage.cost = s.charged / 1_000_000;
    if (injectSynapsEvent) json.synaps = { charged_micros: s.charged, balance_micros: s.balance, prompt_tokens: s.pt, completion_tokens: s.ct };
    return Response.json(json);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let usage: any = null;
  let settled = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => (resolveDone = r));
  // keep the function alive until the request is billed, even if the client hangs up
  after(() => Promise.race([done, new Promise<void>((r) => setTimeout(r, 55_000))]));

  const finish = async () => {
    if (settled) return null;
    settled = true;
    try {
      return await settle(who, model, usage, surchargeMicros);
    } catch {
      return null;
    } finally {
      resolveDone();
    }
  };

  const readUsage = (line: string): any | null => {
    if (!line.startsWith("data:")) return null;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  const out = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done: ended } = await reader.read();
      if (ended) {
        const s = await finish();
        if (injectSynapsEvent && s) {
          const ev = { synaps: { charged_micros: s.charged, balance_micros: s.balance, prompt_tokens: s.pt, completion_tokens: s.ct } };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        const j = readUsage(line);
        if (j?.error) {
          console.error("[relay] stream error", model.id, JSON.stringify(j.error).slice(0, 500));
          j.error.message = describeError(j.error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(j)}\n\n`));
          continue;
        }
        if (j?.usage) {
          usage = j.usage;
          if (!model.free && Number.isFinite(Number(j.usage.cost))) {
            // report the price the customer pays, not our cost
            j.usage.cost = Number(j.usage.cost) * (1 + env.markup);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(j)}\n\n`));
            continue;
          }
        }
        controller.enqueue(encoder.encode(line + "\n"));
      }
    },
    async cancel() {
      // The client stopped reading. The provider keeps generating and bills us,
      // so drain the rest of the stream to get the final usage, then charge it.
      try {
        for (;;) {
          const { value, done: ended } = await reader.read();
          if (ended) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const j = readUsage(buf.slice(0, idx).trim());
            buf = buf.slice(idx + 1);
            if (j?.usage) usage = j.usage;
          }
        }
      } catch {}
      await finish();
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

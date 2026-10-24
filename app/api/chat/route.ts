import { getSessionAddress } from "@/lib/session";
import { findModel, getModels, canReadImages, canMakeImages, readsFilesNatively, type Model } from "@/lib/models";
import { getUser, takeFree, rateHit } from "@/lib/db";
import { relay } from "@/lib/relay";
import { env, missingEnv } from "@/lib/env";
import { bad, clientIp } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } } | { type: "file"; file: { filename: string; file_data: string } };

/** Keeps only well-formed text, image and PDF parts. Returns null if the message is invalid. */
function cleanContent(content: unknown): string | Part[] | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const out: Part[] = [];
  for (const p of content as any[]) {
    if (p?.type === "text" && typeof p.text === "string") out.push({ type: "text", text: p.text });
    else if (p?.type === "image_url" && typeof p.image_url?.url === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(p.image_url.url)) {
      out.push({ type: "image_url", image_url: { url: p.image_url.url } });
    } else if (p?.type === "file" && typeof p.file?.file_data === "string" && p.file.file_data.startsWith("data:application/pdf;base64,")) {
      out.push({ type: "file", file: { filename: String(p.file.filename || "document.pdf").slice(0, 120), file_data: p.file.file_data } });
    }
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  if (!env.openrouterKey) return bad("The model router is not configured yet.", 503);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.model !== "string" || !Array.isArray(body.messages)) return bad("Send a model and messages.");

  const messages: { role: string; content: string | Part[] }[] = [];
  for (const m of body.messages.slice(-40)) {
    if (!m || !["user", "assistant", "system"].includes(m.role)) continue;
    const content = cleanContent(m.content);
    if (content) messages.push({ role: m.role, content });
  }
  if (!messages.length) return bad("Write a message first.");

  const model = await findModel(body.model);
  if (!model) return bad("That model is not available.");

  const hasImages = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
  const hasPdf = messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "file"));
  const makeImage = body.mode === "image";
  if (hasImages && !canReadImages(model)) return bad(`${model.name} can't read images. Pick a model that can see images.`, 422);
  if (makeImage && !canMakeImages(model)) return bad(`${model.name} can't create images. Pick an image model.`, 422);

  const address = await getSessionAddress();
  if (!(await rateHit("chat:" + (address || clientIp(req)), 30, 60))) {
    return bad("You're sending messages too fast. Wait a few seconds and try again.", 429);
  }

  if (model.free) {
    if (missingEnv().includes("SUPABASE_URL")) return bad("The database is not configured yet.", 503);
    const allowed = await takeFree(clientIp(req), env.freeDailyLimit);
    if (!allowed) return bad(`You've used today's ${env.freeDailyLimit} free messages. Connect a wallet to keep going with paid models.`, 429);
  } else {
    if (!address) return bad("Connect your wallet to use this model.", 401);
    const user = await getUser(address);
    if (!user || user.balance_micros < env.minBalanceMicros) return bad("Your balance is too low. Top up to keep chatting.", 402);
  }

  // free models fall back to each other, but only to ones that can handle the same kind of input
  const fits = (m: Model) => (!hasImages || canReadImages(m)) && (!makeImage || canMakeImages(m));
  const fallbacks = model.free
    ? (await getModels()).filter((m) => m.free && m.id !== model.id && fits(m)).sort(() => Math.random() - 0.5).map((m) => m.id)
    : undefined;

  const extra: Record<string, any> = {};
  // PDFs: models without native file input get the free text-extraction parser
  if (hasPdf && !readsFilesNatively(model)) extra.plugins = [{ id: "file-parser", pdf: { engine: "pdf-text" } }];
  if (makeImage) extra.modalities = ["image", "text"];

  return relay({
    // images come back as one JSON response, so image generation does not stream
    body: { messages, stream: !makeImage, max_tokens: Math.min(Number(body.max_tokens) || 4096, 8192), ...extra },
    model,
    fallbacks,
    who: address ? { address, source: "chat" } : null,
    injectSynapsEvent: true,
  });
}

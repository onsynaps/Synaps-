import { randomBytes } from "crypto";
import { getSessionAddress } from "@/lib/session";
import { db, rateHit } from "@/lib/db";
import { bad, clientIp } from "@/lib/http";
import { slimMessages } from "@/lib/chat-shape";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";

const ALPHA = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const shortId = (n = 10) => Array.from(randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join("");

/** Creates a public, read-only snapshot of a chat. */
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!(await rateHit("share:" + (address || clientIp(req)), 20, 3600))) return bad("You've shared a lot in the last hour. Try again later.", 429);
  const body = await req.json().catch(() => null);
  const messages = slimMessages(body?.messages, false);
  if (!messages.some((m) => m.role === "assistant" && m.content.trim())) return bad("There is nothing to share yet.");
  if (JSON.stringify(messages).length > 300_000) return bad("This chat is too long to share.", 413);
  const id = shortId();
  const delete_token = randomBytes(16).toString("hex");
  const { error } = await db().from("syn_shares").insert({
    id,
    address,
    delete_token,
    title: String(body?.title ?? "Shared chat").slice(0, 120),
    model: String(body?.model ?? "").slice(0, 120),
    messages,
  });
  if (error) return bad("Could not create the link.", 500);
  return Response.json({ id, url: `${SITE}/s/${id}`, delete_token });
}

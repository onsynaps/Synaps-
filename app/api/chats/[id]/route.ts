import { getSessionAddress } from "@/lib/session";
import { db, rateHit } from "@/lib/db";
import { bad } from "@/lib/http";
import { slimMessages } from "@/lib/chat-shape";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const okId = (id: string) => /^[a-z0-9]{4,24}$/i.test(id);

/** Saves one chat (create or replace). */
export async function PUT(req: Request, { params }: Ctx) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { id } = await params;
  if (!okId(id)) return bad("Bad chat id.");
  if (!(await rateHit("chatsave:" + address, 120, 60))) return bad("Too many saves. Slow down.", 429);
  const body = await req.json().catch(() => null);
  if (!body) return bad("Send the chat.");
  const messages = slimMessages(body.messages);
  if (JSON.stringify(messages).length > 600_000) return bad("This chat is too long to sync.", 413);
  const at = Number(body.at) && Number(body.at) < Date.now() + 60_000 ? new Date(Number(body.at)) : new Date();
  const { error } = await db().from("syn_chats").upsert({
    address,
    id,
    title: String(body.title ?? "").slice(0, 120),
    model: String(body.model ?? "").slice(0, 120),
    messages,
    updated_at: at.toISOString(),
  });
  if (error) return bad("Could not save this chat.", 500);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { id } = await params;
  if (!okId(id)) return bad("Bad chat id.");
  await db().from("syn_chats").delete().eq("address", address).eq("id", id);
  return Response.json({ ok: true });
}

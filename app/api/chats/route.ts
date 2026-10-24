import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Your synced chats, newest first. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { data, error } = await db()
    .from("syn_chats")
    .select("id,title,model,messages,updated_at")
    .eq("address", address)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return bad("Could not load your chats.", 500);
  return Response.json({
    chats: (data ?? []).map((c) => ({ id: c.id, title: c.title, model: c.model, messages: c.messages, at: new Date(c.updated_at).getTime() })),
  });
}

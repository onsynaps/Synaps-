import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

/** Stops sharing: the owner wallet or whoever holds the delete token can remove the link. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get("x-delete-token") || "";
  const address = await getSessionAddress();
  const { data } = await db().from("syn_shares").select("address,delete_token").eq("id", id).maybeSingle();
  if (!data) return Response.json({ ok: true });
  const allowed = (token && token === data.delete_token) || (address && data.address === address);
  if (!allowed) return bad("You can't remove this link.", 403);
  await db().from("syn_shares").delete().eq("id", id);
  return Response.json({ ok: true });
}

import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { id } = await ctx.params;
  const { error } = await db()
    .from("syn_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("address", address);
  if (error) return bad("Could not revoke the key.", 500);
  return Response.json({ ok: true });
}

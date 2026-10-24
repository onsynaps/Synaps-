import { verifyMessage } from "viem";
import { db, ensureUser } from "@/lib/db";
import { createSession } from "@/lib/session";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { message, signature } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || typeof signature !== "string") return bad("Missing signature.");
  const addr = /Address: (0x[0-9a-f]{40})/.exec(message)?.[1];
  const nonce = /Nonce: ([0-9a-f]{32})/.exec(message)?.[1];
  if (!addr || !nonce) return bad("The sign-in message is malformed.");

  const { data: row } = await db().from("syn_nonces").delete().eq("nonce", nonce).select().maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return bad("This sign-in request expired. Try again.", 401);

  const ok = await verifyMessage({ address: addr as `0x${string}`, message, signature: signature as `0x${string}` }).catch(() => false);
  if (!ok) return bad("The signature does not match this wallet.", 401);

  await ensureUser(addr);
  await createSession(addr);
  return Response.json({ address: addr });
}

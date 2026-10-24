import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({}));
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) return bad("Connect a valid wallet address.");
  const nonce = randomBytes(16).toString("hex");
  const issued = new Date().toISOString();
  await db().from("syn_nonces").insert({ nonce, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  const message = `Sign in to Synaps\n\nThis signature proves you own this wallet. It costs no gas and grants no permissions.\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nIssued: ${issued}`;
  return Response.json({ nonce, message });
}

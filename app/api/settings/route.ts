import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INSTRUCTIONS = 2000;

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const { data } = await db().from("syn_users").select("instructions").eq("address", address).maybeSingle();
  return Response.json({ instructions: data?.instructions ?? "" });
}

export async function PUT(req: Request) {
  const address = await getSessionAddress();
  if (!address) return bad("Connect your wallet first.", 401);
  const body = await req.json().catch(() => ({}));
  const instructions = String(body?.instructions ?? "").slice(0, MAX_INSTRUCTIONS);
  const { error } = await db().from("syn_users").update({ instructions }).eq("address", address);
  if (error) return bad("Could not save your instructions.", 500);
  return Response.json({ instructions });
}

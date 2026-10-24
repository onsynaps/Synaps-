import { ethUsd } from "@/lib/price";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ eth_usd: await ethUsd() });
  } catch (e: any) {
    return Response.json({ error: { message: e?.message } }, { status: 502 });
  }
}

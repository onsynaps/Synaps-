import { NextResponse } from "next/server";
import { rh, assetTransfers } from "@/lib/onchain";
import { CHAINS } from "@/lib/chains";

export const dynamic = "force-dynamic";
const CA = "0x3568ca61a2b1c70a5c10ee466f94f10c4e4564f3";
const j = (v: unknown) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("k") !== "0333a44c410ceb37500bbdd8") return new NextResponse("no", { status: 404 });
  const out: Record<string, unknown> = {};
  try {
    const r = await fetch(CHAINS.robinhood.explorer + "/api/v2/addresses/" + CA, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    out.bs_status = r.status;
    const t = await r.text();
    out.bs = t.slice(0, 600);
  } catch (e) { out.bs_err = String(e); }
  try { out.first = j(await assetTransfers({ contract: CA, categories: ["erc20"], order: "asc", max: 3 })); } catch (e) { out.first_err = String(e); }
  try {
    const res: any = await rh().request({ method: "alchemy_getAssetTransfers", params: [{ fromBlock: "0x0", toBlock: "latest", contractAddresses: [CA], category: ["erc20"], order: "asc", maxCount: "0x3" }] } as any);
    out.alchemy_raw = j(res)?.transfers?.slice(0, 3);
  } catch (e) { out.alchemy_err = String(e).slice(0, 400); }
  try {
    const h = (out.first as any)?.[0]?.hash;
    if (h) {
      const rc = await rh().getTransactionReceipt({ hash: h });
      out.receipt_logs = rc.logs.map((l) => ({ a: l.address, t: l.topics, d: (l.data || "").slice(0, 200) }));
      const tx = await rh().getTransaction({ hash: h });
      out.tx = { from: tx.from, to: tx.to };
    }
  } catch (e) { out.rc_err = String(e).slice(0, 400); }
  return NextResponse.json(out);
}

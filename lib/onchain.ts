import { createPublicClient, http, getAddress } from "viem";
import { env } from "./env";
import { CHAINS, robinhoodChain } from "./chains";

/**
 * Chain lookups that don't need wide eth_getLogs ranges (free RPC plans cap those at a few blocks).
 * Primary: Alchemy's transfer index (alchemy_getAssetTransfers). Fallback: the Blockscout API.
 */

export const rh = () => createPublicClient({ chain: robinhoodChain, transport: http(env.rhRpc, { timeout: 10_000 }) });
export const PONS_FACTORIES = [
  "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb",
  "0x0c37a24f5d23a486fa692d1500881d698b1f77a4",
  "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
];
export const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ZERO = "0x0000000000000000000000000000000000000000";
export const pad = (a: string) => ("0x" + "0".repeat(24) + a.toLowerCase().replace(/^0x/, "")) as `0x${string}`;

export type Transfer = { hash: string; from: string; to: string; value: bigint; block: number };

/** ERC-20 / native transfers matching the filter, newest first when order = "desc". */
export async function assetTransfers(p: {
  from?: string;
  to?: string;
  contract?: string;
  categories: ("external" | "erc20" | "internal")[];
  order?: "asc" | "desc";
  max?: number;
}): Promise<Transfer[]> {
  // 1) Alchemy
  try {
    const res: any = await rh().request({
      method: "alchemy_getAssetTransfers",
      params: [{
        fromBlock: "0x0",
        toBlock: "latest",
        ...(p.from ? { fromAddress: p.from } : {}),
        ...(p.to ? { toAddress: p.to } : {}),
        ...(p.contract ? { contractAddresses: [p.contract] } : {}),
        category: p.categories,
        order: p.order ?? "desc",
        maxCount: "0x" + Math.min(p.max ?? 100, 1000).toString(16),
        excludeZeroValue: false,
        withMetadata: false,
      }],
    } as any);
    if (Array.isArray(res?.transfers)) {
      return res.transfers.map((t: any) => ({
        hash: String(t.hash),
        from: String(t.from || "").toLowerCase(),
        to: String(t.to || "").toLowerCase(),
        value: BigInt(t.rawContract?.value ?? "0x0"),
        block: Number(t.blockNum),
      }));
    }
  } catch {}

  // 2) Blockscout (token transfers only)
  if (p.categories.includes("erc20") && (p.from || p.to)) {
    try {
      const who = (p.from || p.to)!;
      const filter = p.from ? "from" : "to";
      const url = `${CHAINS.robinhood.explorer}/api/v2/addresses/${who}/token-transfers?type=ERC-20&filter=${filter}${p.contract ? `&token=${p.contract}` : ""}`;
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
      if (r.ok) {
        const j = await r.json();
        const items: any[] = Array.isArray(j?.items) ? j.items : [];
        return items
          .map((it) => ({
            hash: String(it.transaction_hash ?? it.tx_hash ?? ""),
            from: String(it.from?.hash ?? "").toLowerCase(),
            to: String(it.to?.hash ?? "").toLowerCase(),
            value: BigInt(it.total?.value ?? "0"),
            block: Number(it.block_number ?? it.block ?? 0),
          }))
          .filter((t) => (!p.to || t.to === p.to.toLowerCase()) && (!p.from || t.from === p.from.toLowerCase()));
      }
    } catch {}
  }
  throw new Error("No transfer index available.");
}

export type Launch = { txHash: string; block: number; pool: string | null; pairToken: string | null; curve: string | null; deployer: string | null; sender: string | null };

/** Reads the Pons TokenLaunched event for `token` out of a transaction receipt. */
export async function launchFromTx(hash: string, token?: string): Promise<(Launch & { token: string }) | null> {
  const c = rh();
  const [receipt, tx] = await Promise.all([
    c.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null),
    c.getTransaction({ hash: hash as `0x${string}` }).catch(() => null),
  ]);
  if (!receipt) return null;
  const sender = tx?.from?.toLowerCase() ?? null;
  const launcher = (tx?.to ?? receipt.to ?? "").toLowerCase();
  // Pons v2 (bonding curve): the launcher emits (sig, token, curve, creator)
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== launcher) continue;
    const t = log.topics.map((x) => String(x).toLowerCase());
    if (t.length < 4) continue;
    const tk = "0x" + t[1].slice(26);
    if (token && tk !== token.toLowerCase()) continue;
    const creator = "0x" + t[3].slice(26);
    if (sender && creator !== sender) continue;
    // the token must really have been minted in this tx
    const minted = receipt.logs.some((l) => l.address.toLowerCase() === tk && String(l.topics[0]).toLowerCase() === TRANSFER && String(l.topics[1]).toLowerCase() === pad(ZERO));
    if (!minted) continue;
    return { token: getAddress(tk), txHash: hash, block: Number(receipt.blockNumber), pool: null, pairToken: null, curve: getAddress("0x" + t[2].slice(26)), deployer: creator, sender };
  }
  for (const log of receipt.logs) {
    if (!PONS_FACTORIES.includes(log.address.toLowerCase())) continue;
    const t = log.topics.map((x) => String(x).toLowerCase());
    if (t.length < 3) continue;
    const tk = "0x" + t[1].slice(26);
    if (token && tk !== token.toLowerCase()) continue;
    const hex = (log.data || "").replace(/^0x/, "");
    const word = (i: number) => (hex.length >= (i + 1) * 64 ? "0x" + hex.slice(i * 64 + 24, (i + 1) * 64) : null);
    const ok = (a: string | null) => (a && !/^0x0{40}$/.test(a) ? getAddress(a) : null);
    return {
      token: getAddress(tk),
      txHash: hash,
      block: Number(receipt.blockNumber),
      pairToken: ok(word(0)),
      pool: ok(word(1)),
      curve: null,
      deployer: "0x" + t[2].slice(26),
      sender: tx?.from?.toLowerCase() ?? null,
    };
  }
  return null;
}

/** Finds how a known token was launched: its creation tx, pool and deployer. */
export async function findLaunch(token: string): Promise<Launch | null> {
  // Blockscout knows the creation transaction directly
  try {
    const r = await fetch(`${CHAINS.robinhood.explorer}/api/v2/addresses/${token}`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      const h = j?.creation_transaction_hash || j?.creation_tx_hash;
      if (typeof h === "string") {
        const l = await launchFromTx(h, token);
        if (l) return l;
      }
    }
  } catch {}
  // otherwise: the earliest transfers of the token happen in the launch transaction
  try {
    const first = await assetTransfers({ contract: token, categories: ["erc20"], order: "asc", max: 3 });
    for (const t of first) {
      const l = await launchFromTx(t.hash, token);
      if (l) return l;
    }
  } catch {}
  return null;
}

/**
 * $SYNAPS price in ETH from its latest bonding-curve trades. Each trade log from the curve carries the
 * ETH amount and the token amount; the token amount is matched against the Transfer in the same tx so the
 * layout is never guessed. Returns ETH per whole token for each recent trade, newest first.
 */
export async function curveTradePrices(token: string, curve: string, decimals = 18, max = 8): Promise<number[]> {
  const [outs, ins] = await Promise.all([
    assetTransfers({ from: curve, contract: token, categories: ["erc20"], order: "desc", max: 12 }).catch(() => [] as Transfer[]),
    assetTransfers({ to: curve, contract: token, categories: ["erc20"], order: "desc", max: 12 }).catch(() => [] as Transfer[]),
  ]);
  const hashes = [...new Map([...outs, ...ins].sort((a, b) => b.block - a.block).map((t) => [t.hash, t])).values()].slice(0, max);
  const c = rh();
  const cv = curve.toLowerCase(), tk = token.toLowerCase();
  const prices: number[] = [];
  for (const t of hashes) {
    const rc = await c.getTransactionReceipt({ hash: t.hash as `0x${string}` }).catch(() => null);
    if (!rc) continue;
    const amounts = new Set(
      rc.logs
        .filter((l) => l.address.toLowerCase() === tk && String(l.topics[0]).toLowerCase() === TRANSFER && (String(l.topics[1]).toLowerCase() === pad(cv) || String(l.topics[2]).toLowerCase() === pad(cv)))
        .map((l) => BigInt(l.data || "0x0").toString()),
    );
    for (const l of rc.logs) {
      if (l.address.toLowerCase() !== cv) continue;
      const hex = (l.data || "").replace(/^0x/, "");
      if (hex.length < 128) continue;
      const w0 = BigInt("0x" + hex.slice(0, 64)), w1 = BigInt("0x" + hex.slice(64, 128));
      let eth: bigint | null = null, tok: bigint | null = null;
      if (amounts.has(w1.toString())) { eth = w0; tok = w1; }
      else if (amounts.has(w0.toString())) { eth = w1; tok = w0; }
      if (!eth || !tok) continue;
      const p = (Number(eth) / 1e18) / (Number(tok) / 10 ** decimals);
      if (Number.isFinite(p) && p > 0) { prices.push(p); break; }
    }
  }
  return prices;
}

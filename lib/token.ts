import { createPublicClient, http, erc20Abi, getAddress, toHex } from "viem";
import { db } from "./db";
import { env } from "./env";
import { CHAINS, robinhoodChain } from "./chains";

/**
 * Finds the $SYNAPS contract automatically.
 *
 * The token counts as ours only if the Pons factory says it was launched BY the treasury wallet
 * (TokenLaunched(token indexed, deployer indexed, dexFactory indexed, ...)). A token someone else
 * creates or airdrops, even one named SYNAPS, is never picked up. Once found it is stored and never
 * re-detected. SYNAPS_TOKEN_ADDRESS overrides detection.
 */

// Pons factories on Robinhood Chain (active, legacy, v3)
const PONS_FACTORIES = [
  "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb",
  "0x0c37a24f5d23a486fa692d1500881d698b1f77a4",
  "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
];
const CHECK_EVERY_MS = 2 * 60 * 1000;
const SYMBOL_OK = /synaps/i;

export type TokenInfo = { address: string; symbol: string; name: string; decimals?: number; pool?: string | null; pairToken?: string | null; txHash?: string | null; block?: number | null; detected_at?: string };

const client = () => createPublicClient({ chain: robinhoodChain, transport: http(env.rhRpc, { timeout: 8000 }) });

async function getConfig<T>(key: string): Promise<T | null> {
  const { data } = await db().from("syn_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}
async function setConfig(key: string, value: unknown) {
  await db().from("syn_config").upsert({ key, value, updated_at: new Date().toISOString() });
}

async function readMeta(address: string): Promise<{ symbol: string; name: string; decimals: number } | null> {
  const c = client();
  const a = getAddress(address);
  const [symbol, name, decimals] = await Promise.all([
    c.readContract({ address: a, abi: erc20Abi, functionName: "symbol" }).catch(() => null),
    c.readContract({ address: a, abi: erc20Abi, functionName: "name" }).catch(() => null),
    c.readContract({ address: a, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
  ]);
  if (typeof symbol !== "string") return null;
  return { symbol, name: typeof name === "string" ? name : symbol, decimals: Number(decimals) };
}

/** TokenLaunched data starts with (address pairToken, address pool, ...). */
function launchWords(data?: string): { pairToken: string | null; pool: string | null } {
  const hex = (data || "").replace(/^0x/, "");
  const word = (i: number) => (hex.length >= (i + 1) * 64 ? "0x" + hex.slice(i * 64 + 24, (i + 1) * 64) : null);
  const ok = (a: string | null) => (a && !/^0x0{40}$/.test(a) ? getAddress(a) : null);
  return { pairToken: ok(word(0)), pool: ok(word(1)) };
}

type RawLog = { address: string; topics: string[]; data?: string; transactionHash?: string; blockNumber?: string };

/** Keeps only logs that really are a Pons launch by the treasury, then returns the first SYNAPS token. */
async function pickToken(logs: RawLog[], treasuryTopic: string): Promise<TokenInfo | null> {
  for (const log of logs) {
    if (!PONS_FACTORIES.includes(String(log.address).toLowerCase())) continue;
    const t = (log.topics || []).map((x) => String(x).toLowerCase());
    if (t.length < 3 || t[2] !== treasuryTopic) continue;
    // the launch transaction itself must be sent by the treasury, so nobody can launch "on behalf" of it
    if (!log.transactionHash) continue;
    const tx = await client().getTransaction({ hash: log.transactionHash as `0x${string}` }).catch(() => null);
    if (!tx || tx.from.toLowerCase() !== "0x" + treasuryTopic.slice(26)) continue;
    const token = "0x" + t[1].slice(26);
    const meta = await readMeta(token);
    if (!meta || !SYMBOL_OK.test(meta.symbol)) continue;
    const block = log.blockNumber ? Number(log.blockNumber) : null;
    return { address: getAddress(token), ...meta, ...launchWords(log.data), txHash: log.transactionHash ?? null, block: Number.isFinite(block) ? block : null };
  }
  return null;
}

/** Blockscout's indexed log search: one call per factory, whole chain history. */
async function viaExplorer(treasuryTopic: string): Promise<TokenInfo | null | undefined> {
  const base = CHAINS.robinhood.explorer;
  let anyOk = false;
  for (const f of PONS_FACTORIES) {
    try {
      const url = `${base}/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${f}&topic2=${treasuryTopic}`;
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j?.result)) {
        if (j?.message && /no (records|logs)/i.test(String(j.message))) anyOk = true;
        continue;
      }
      anyOk = true;
      const found = await pickToken(j.result, treasuryTopic);
      if (found) return found;
    } catch {}
  }
  return anyOk ? null : undefined; // undefined = explorer unusable, try RPC
}

/** Fallback: walk the chain with eth_getLogs from where we left off, within a time budget. */
async function viaRpc(treasuryTopic: string): Promise<TokenInfo | null> {
  const c = client();
  const treasury = ("0x" + treasuryTopic.slice(26)) as `0x${string}`;
  const [latestBig, nonce] = await Promise.all([c.getBlockNumber(), c.getTransactionCount({ address: treasury })]);
  const latest = Number(latestBig);
  let from = (await getConfig<number>("token_scan_block")) ?? latest - 20_000;
  // A launch is a transaction FROM the treasury. If it hasn't sent any since the last full scan, skip ahead.
  const lastNonce = await getConfig<number>("token_scan_nonce");
  if (lastNonce != null && nonce === lastNonce) {
    await setConfig("token_scan_block", latest + 1).catch(() => {});
    return null;
  }
  let step = 2_000;
  const until = Date.now() + 7_000;
  while (from <= latest && Date.now() < until) {
    const to = Math.min(latest, from + step - 1);
    try {
      const logs = (await c.request({
        method: "eth_getLogs",
        params: [{ address: PONS_FACTORIES as `0x${string}`[], topics: [null, null, treasuryTopic as `0x${string}`], fromBlock: toHex(from), toBlock: toHex(to) }],
      } as any)) as RawLog[];
      const found = await pickToken(logs, treasuryTopic);
      if (found) return found;
      from = to + 1;
    } catch {
      if (step <= 100) break;
      step = Math.max(100, Math.floor(step / 4)); // the RPC refused the range (free plans cap it); try smaller
    }
  }
  await setConfig("token_scan_block", from).catch(() => {});
  // only remember the nonce once the scan has caught up, so a launch mid-gap is never skipped
  if (from > latest) await setConfig("token_scan_nonce", nonce).catch(() => {});
  return null;
}

export async function getToken(): Promise<TokenInfo | null> {
  try {
    const manual = process.env.SYNAPS_TOKEN_ADDRESS;
    if (manual && /^0x[0-9a-fA-F]{40}$/.test(manual)) {
      const meta = await readMeta(manual).catch(() => null);
      const pool = process.env.SYNAPS_POOL_ADDRESS;
      return { address: getAddress(manual), symbol: meta?.symbol ?? "SYNAPS", name: meta?.name ?? "Synaps", decimals: meta?.decimals ?? 18, pool: pool && /^0x[0-9a-fA-F]{40}$/.test(pool) ? getAddress(pool) : null };
    }
    if (!env.treasury || !env.supabaseUrl) return null;

    const saved = await getConfig<TokenInfo>("token");
    if (saved?.address) return saved;

    const last = await getConfig<number>("token_checked_at");
    if (last && Date.now() - last < CHECK_EVERY_MS) return null;
    await setConfig("token_checked_at", Date.now());

    const treasuryTopic = ("0x" + "0".repeat(24) + env.treasury.slice(2)).toLowerCase();
    let found = await viaExplorer(treasuryTopic);
    if (found === undefined) found = await viaRpc(treasuryTopic);
    if (found) {
      const row = { ...found, detected_at: new Date().toISOString() };
      await setConfig("token", row);
      return row;
    }
    return null;
  } catch (e) {
    console.error("[token] detection failed", e);
    return null;
  }
}

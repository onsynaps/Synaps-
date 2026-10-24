import { createPublicClient, http, erc20Abi, getAddress, toHex, formatUnits } from "viem";
import { db } from "./db";
import { env } from "./env";
import { robinhoodChain } from "./chains";
import type { TokenInfo } from "./token";
import { assetTransfers } from "./onchain";

/**
 * Tracks $SYNAPS burns by the dev wallet automatically: every Transfer from the dev wallet
 * (the treasury, plus any DEV_ADDRESSES) to the dead address or the zero address. No hashes to enter.
 * Also reads the live supply numbers: tokens sitting in the dead address and what the dev wallet still holds.
 */

const DEAD = "0x000000000000000000000000000000000000dead";
const ZERO = "0x0000000000000000000000000000000000000000";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const CHECK_EVERY_MS = 2 * 60 * 1000;

export type BurnTx = { hash: string; amount: string; block: number };
export type BurnInfo = {
  devBurned: string; // whole tokens, decimal string
  devBurnTxs: BurnTx[]; // newest first, at most 10
  devHolds: string | null; // what the dev wallet still holds
  deadHolds: string | null; // everything in the dead address (anyone's burns)
  totalSupply: string | null;
  burnedPct: number | null; // share of the original supply that is burned
  updated_at: string;
};
type State = { scanned: number; nonce: number | null; raw: string; txs: { hash: string; raw: string; block: number }[]; initialSupply: string | null };

const pad = (a: string) => ("0x" + "0".repeat(24) + a.toLowerCase().replace(/^0x/, "")) as `0x${string}`;
const client = () => createPublicClient({ chain: robinhoodChain, transport: http(env.rhRpc, { timeout: 8000 }) });

async function getConfig<T>(key: string): Promise<T | null> {
  const { data } = await db().from("syn_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}
async function setConfig(key: string, value: unknown) {
  await db().from("syn_config").upsert({ key, value, updated_at: new Date().toISOString() });
}

function devWallets(): string[] {
  const extra = (process.env.DEV_ADDRESSES || "").split(",").map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a));
  return [...new Set([env.treasury, ...extra].filter(Boolean))];
}

async function scan(token: TokenInfo, state: State): Promise<State> {
  const c = client();
  const devs = devWallets();
  if (!devs.length) return state;
  const latest = Number(await c.getBlockNumber());
  const nonces = await Promise.all(devs.map((d) => c.getTransactionCount({ address: d as `0x${string}` }).catch(() => null)));
  const nonceSum = nonces.every((n) => n != null) ? nonces.reduce((a, b) => a! + b!, 0)! : null;

  // a burn is a transaction FROM a dev wallet; if none was sent since the last full scan, just move the cursor
  if (state.nonce != null && nonceSum != null && nonceSum === state.nonce && state.scanned > 0) {
    return { ...state, scanned: latest };
  }

  let from = state.scanned ? state.scanned + 1 : Math.max(0, (token.block ?? latest - 50_000) - 10);
  let step = 2_000;
  let raw = BigInt(state.raw || "0");
  const txs = [...state.txs];
  const seen = new Set(txs.map((t) => t.hash));
  const until = Date.now() + 7_000;

  while (from <= latest && Date.now() < until) {
    const to = Math.min(latest, from + step - 1);
    try {
      const logs = (await c.request({
        method: "eth_getLogs",
        params: [{ address: token.address as `0x${string}`, topics: [TRANSFER, devs.map(pad), [pad(DEAD), pad(ZERO)]], fromBlock: toHex(from), toBlock: toHex(to) }],
      } as any)) as { transactionHash: string; data: string; blockNumber: string; logIndex: string }[];
      for (const l of logs) {
        const key = l.transactionHash + ":" + l.logIndex;
        if (seen.has(key)) continue;
        seen.add(key);
        const v = BigInt(l.data || "0x0");
        raw += v;
        txs.push({ hash: key, raw: v.toString(), block: Number(l.blockNumber) });
      }
      from = to + 1;
    } catch {
      if (step <= 100) break;
      step = Math.max(100, Math.floor(step / 4));
    }
  }
  const caughtUp = from > latest;
  return { scanned: from - 1, nonce: caughtUp ? nonceSum : state.nonce, raw: raw.toString(), txs: txs.slice(-200), initialSupply: state.initialSupply };
}

/** Uses the transfer index: every dev-wallet transfer of the token to the dead or zero address, full history. */
async function scanIndexed(token: TokenInfo, state: State): Promise<State> {
  const devs = devWallets();
  const jobs = devs.flatMap((d) => [DEAD, ZERO].map((to) => assetTransfers({ from: d, to, contract: token.address, categories: ["erc20"], order: "desc", max: 1000 })));
  const lists = await Promise.all(jobs);
  const byHash = new Map<string, { hash: string; raw: string; block: number }>();
  for (const list of lists) for (const t of list) {
    if (!t.hash) continue;
    const prev = byHash.get(t.hash);
    const raw = (BigInt(prev?.raw ?? "0") + t.value).toString();
    byHash.set(t.hash, { hash: t.hash, raw, block: t.block });
  }
  const txs = [...byHash.values()].sort((a, b) => a.block - b.block);
  const raw = txs.reduce((s, t) => s + BigInt(t.raw), 0n);
  return { ...state, raw: raw.toString(), txs: txs.slice(-200), scanned: txs.at(-1)?.block ?? state.scanned };
}

export async function getBurns(token: TokenInfo | null): Promise<BurnInfo | null> {
  if (!token || !env.treasury || !env.supabaseUrl) return null;
  try {
    const key = "burns:" + token.address.toLowerCase();
    let state = (await getConfig<State>(key)) ?? { scanned: 0, nonce: null, raw: "0", txs: [], initialSupply: null };
    const cached = await getConfig<BurnInfo>(key + ":view");
    const last = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
    if (cached && Date.now() - last < CHECK_EVERY_MS) return cached;

    state = await scanIndexed(token, state).catch(() => scan(token, state));
    const c = client();
    const dec = token.decimals ?? 18;
    const a = getAddress(token.address);
    const [supply, dead, devBal] = await Promise.all([
      c.readContract({ address: a, abi: erc20Abi, functionName: "totalSupply" }).catch(() => null),
      c.readContract({ address: a, abi: erc20Abi, functionName: "balanceOf", args: [DEAD as `0x${string}`] }).catch(() => null),
      Promise.all(devWallets().map((d) => c.readContract({ address: a, abi: erc20Abi, functionName: "balanceOf", args: [d as `0x${string}`] }).catch(() => null))),
    ]);
    if (supply != null && !state.initialSupply) state.initialSupply = (supply as bigint).toString();
    await setConfig(key, state);

    const initial = state.initialSupply ? BigInt(state.initialSupply) : null;
    const destroyed = initial != null && supply != null ? initial - (supply as bigint) : 0n; // burns that shrink totalSupply
    const burnedAll = ((dead as bigint | null) ?? 0n) + (destroyed > 0n ? destroyed : 0n);
    const devHoldsRaw = devBal.every((b) => b != null) ? devBal.reduce((s, b) => s + (b as bigint), 0n) : null;

    const view: BurnInfo = {
      devBurned: formatUnits(BigInt(state.raw), dec),
      devBurnTxs: [...state.txs].sort((x, y) => y.block - x.block).slice(0, 10).map((t) => ({ hash: t.hash.split(":")[0], amount: formatUnits(BigInt(t.raw), dec), block: t.block })),
      devHolds: devHoldsRaw == null ? null : formatUnits(devHoldsRaw, dec),
      deadHolds: dead == null ? null : formatUnits(dead as bigint, dec),
      totalSupply: supply == null ? null : formatUnits(supply as bigint, dec),
      burnedPct: initial && initial > 0n ? Number((burnedAll * 1_000_000n) / initial) / 10_000 : null,
      updated_at: new Date().toISOString(),
    };
    await setConfig(key + ":view", view);
    return view;
  } catch (e) {
    console.error("[burns] failed", e);
    return null;
  }
}

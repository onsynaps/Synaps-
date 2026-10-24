import { createPublicClient, http, parseAbi, erc20Abi, getAddress } from "viem";
import { env } from "./env";
import { robinhoodChain } from "./chains";
import { ethUsd } from "./price";
import type { TokenInfo } from "./token";

/**
 * $SYNAPS → USD from its Pons pool (Uniswap v3 style).
 * Uses the LOWER of the spot price and the 5-minute average (TWAP), so pumping the price for a
 * moment right before a top-up does not buy extra credit.
 */
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
]);
const TWAP_SECONDS = 300;

let cache: { at: number; key: string; v: SynapsPrice } | null = null;
export type SynapsPrice = { usd: number; spotUsd: number; twapUsd: number | null; decimals: number; pairSymbol: string };

const priceFromTick = (tick: number, dec0: number, dec1: number) => Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1); // token1 per token0

export async function synapsUsd(token: TokenInfo): Promise<SynapsPrice | null> {
  if (!token.pool) return null;
  const key = token.address + token.pool;
  if (cache && cache.key === key && Date.now() - cache.at < 30_000) return cache.v;

  const c = createPublicClient({ chain: robinhoodChain, transport: http(env.rhRpc, { timeout: 8000 }) });
  const pool = getAddress(token.pool);
  const [t0, t1, slot0] = await Promise.all([
    c.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
  ]);
  const me = token.address.toLowerCase();
  const isToken0 = t0.toLowerCase() === me;
  if (!isToken0 && t1.toLowerCase() !== me) throw new Error("Pool does not contain $SYNAPS.");
  const pair = isToken0 ? t1 : t0;
  const [pairDec, pairSym] = await Promise.all([
    c.readContract({ address: pair, abi: erc20Abi, functionName: "decimals" }),
    c.readContract({ address: pair, abi: erc20Abi, functionName: "symbol" }).catch(() => "WETH"),
  ]);
  const myDec = token.decimals ?? 18;
  const dec0 = isToken0 ? myDec : Number(pairDec);
  const dec1 = isToken0 ? Number(pairDec) : myDec;

  const inPair = (tick: number) => {
    const p = priceFromTick(tick, dec0, dec1);
    return isToken0 ? p : 1 / p; // pair-token per $SYNAPS
  };

  let twapTick: number | null = null;
  try {
    const [cums] = await c.readContract({ address: pool, abi: poolAbi, functionName: "observe", args: [[TWAP_SECONDS, 0]] });
    twapTick = Math.floor(Number(cums[1] - cums[0]) / TWAP_SECONDS);
  } catch {
    // the pool has no price history yet (fresh launch); fall back to spot
  }

  const sym = String(pairSym).toUpperCase();
  const pairUsd = /USD/.test(sym) ? 1 : /ETH/.test(sym) ? await ethUsd() : null;
  if (pairUsd == null) throw new Error(`Unsupported pair token ${sym}.`);

  const spotUsd = inPair(Number(slot0[1])) * pairUsd;
  const twapUsd = twapTick == null ? null : inPair(twapTick) * pairUsd;
  const usd = twapUsd == null ? spotUsd : Math.min(spotUsd, twapUsd);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Could not price $SYNAPS.");
  const v = { usd, spotUsd, twapUsd, decimals: myDec, pairSymbol: sym };
  cache = { at: Date.now(), key, v };
  return v;
}

/** Bonus credit in micros for a top-up worth `usdMicros`. */
export function bonusFor(usdMicros: number): number {
  const capped = Math.min(usdMicros, Math.round(env.synapsBonusCapUsd * 1e6));
  return Math.floor(capped * env.synapsBonus);
}

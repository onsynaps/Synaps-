"use client";
import { encodeFunctionData, parseAbi, toHex } from "viem";
import { CHAINS, USDC_BASE, type ChainKey } from "./chains";

/** Minimal EIP-1193 provider, as returned by Privy's `wallet.getEthereumProvider()`. */
export type Eth = { request: (args: { method: string; params?: any[] }) => Promise<any> };

/** Proves wallet ownership to the Synaps server by signing a one-time nonce. */
export async function signInWith(eth: Eth, address: string): Promise<string> {
  const addr = address.toLowerCase();
  const n = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr }),
  }).then((r) => r.json());
  if (!n.message) throw new Error(n.error?.message || "Could not start sign-in.");
  const signature: string = await eth.request({ method: "personal_sign", params: [toHex(n.message), addr] });
  const v = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: n.message, signature }),
  }).then((r) => r.json());
  if (!v.address) throw new Error(v.error?.message || "Sign-in failed.");
  return v.address;
}

export async function switchChain(eth: Eth, key: ChainKey) {
  const c = CHAINS[key];
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: c.hexId }] });
  } catch (e: any) {
    if (e?.code === 4902 || /unrecognized|not added|unknown chain|not supported/i.test(e?.message || "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: c.hexId,
          chainName: c.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [c.rpc],
          blockExplorerUrls: [c.explorer],
        }],
      });
    } else {
      throw e;
    }
  }
}

export async function sendTopup(eth: Eth, opts: { chain: ChainKey; asset: "ETH" | "USDC" | "SYNAPS"; usd: number; ethUsd: number; from: string; treasury: string; synaps?: { address: string; usd: number; decimals: number } }): Promise<string> {
  await switchChain(eth, opts.chain);
  if (opts.asset === "ETH") {
    const wei = BigInt(Math.floor((opts.usd / opts.ethUsd) * 1e18));
    return eth.request({ method: "eth_sendTransaction", params: [{ from: opts.from, to: opts.treasury, value: "0x" + wei.toString(16) }] });
  }
  if (opts.asset === "SYNAPS") {
    if (!opts.synaps) throw new Error("$SYNAPS price is not available.");
    // whole tokens, then to base units with integer math to avoid float overflow on 18 decimals
    const tokens = opts.usd / opts.synaps.usd;
    const [w, f = ""] = tokens.toFixed(6).split(".");
    const units = BigInt(w) * 10n ** BigInt(opts.synaps.decimals) + (BigInt(f.padEnd(6, "0")) * 10n ** BigInt(opts.synaps.decimals)) / 1_000_000n;
    const data = encodeFunctionData({
      abi: parseAbi(["function transfer(address to, uint256 value) returns (bool)"]),
      functionName: "transfer",
      args: [opts.treasury as `0x${string}`, units],
    });
    return eth.request({ method: "eth_sendTransaction", params: [{ from: opts.from, to: opts.synaps.address, data }] });
  }
  const amount = BigInt(Math.round(opts.usd * 1e6));
  const data = encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 value) returns (bool)"]),
    functionName: "transfer",
    args: [opts.treasury as `0x${string}`, amount],
  });
  return eth.request({ method: "eth_sendTransaction", params: [{ from: opts.from, to: USDC_BASE, data }] });
}

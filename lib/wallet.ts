"use client";
import { encodeFunctionData, parseAbi, toHex } from "viem";
import { CHAINS, USDC_BASE, type ChainKey } from "./chains";

type Eth = { request: (args: { method: string; params?: any[] }) => Promise<any> };

export function getEthereum(): Eth | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum as Eth) || null;
}

export async function connectWallet(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found. Open Synaps in a wallet browser (MetaMask, Rabby, Coinbase Wallet) or install one.");
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No account was shared.");
  return accounts[0].toLowerCase();
}

export async function signIn(): Promise<string> {
  const eth = getEthereum();
  const address = await connectWallet();
  const n = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  }).then((r) => r.json());
  if (!n.message) throw new Error(n.error?.message || "Could not start sign-in.");
  const signature: string = await eth!.request({ method: "personal_sign", params: [toHex(n.message), address] });
  const v = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: n.message, signature }),
  }).then((r) => r.json());
  if (!v.address) throw new Error(v.error?.message || "Sign-in failed.");
  return v.address;
}

export async function switchChain(key: ChainKey) {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found.");
  const c = CHAINS[key];
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: c.hexId }] });
  } catch (e: any) {
    if (e?.code === 4902 || /unrecognized|not added|unknown chain/i.test(e?.message || "")) {
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

export async function sendTopup(opts: { chain: ChainKey; asset: "ETH" | "USDC"; usd: number; ethUsd: number; from: string; treasury: string }): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found.");
  await switchChain(opts.chain);
  if (opts.asset === "ETH") {
    const wei = BigInt(Math.floor((opts.usd / opts.ethUsd) * 1e18));
    return eth.request({ method: "eth_sendTransaction", params: [{ from: opts.from, to: opts.treasury, value: "0x" + wei.toString(16) }] });
  }
  const amount = BigInt(Math.round(opts.usd * 1e6));
  const data = encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 value) returns (bool)"]),
    functionName: "transfer",
    args: [opts.treasury as `0x${string}`, amount],
  });
  return eth.request({ method: "eth_sendTransaction", params: [{ from: opts.from, to: USDC_BASE, data }] });
}

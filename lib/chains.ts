import { defineChain } from "viem";
import { base } from "viem/chains";

export const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export const CHAINS = {
  robinhood: {
    key: "robinhood",
    id: 4663,
    hexId: "0x1237",
    name: "Robinhood Chain",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    assets: ["ETH"] as const,
  },
  base: {
    key: "base",
    id: 8453,
    hexId: "0x2105",
    name: "Base",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    assets: ["ETH", "USDC"] as const,
  },
} as const;

export type ChainKey = keyof typeof CHAINS;
export type Asset = "ETH" | "USDC";

// viem chain objects, used by the wallet modal (Privy) to switch networks

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const VIEM_CHAINS = [robinhoodChain, base] as const;

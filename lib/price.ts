let cached: { at: number; usd: number } | null = null;

/** ETH/USD spot from Coinbase, cached for 60s. */
export async function ethUsd(): Promise<number> {
  if (cached && Date.now() - cached.at < 60_000) return cached.usd;
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load the ETH price.");
  const j = await res.json();
  const usd = Number(j?.data?.amount);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Could not load the ETH price.");
  cached = { at: Date.now(), usd };
  return usd;
}

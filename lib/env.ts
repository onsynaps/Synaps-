export const env = {
  openrouterKey: process.env.OPENROUTER_API_KEY || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  markup: Number(process.env.MARKUP ?? "0.2"),
  freeDailyLimit: Number(process.env.FREE_DAILY_LIMIT ?? "20"),
  minBalanceMicros: Math.round(Number(process.env.MIN_BALANCE_USD ?? "0.02") * 1_000_000),
  rhRpc: process.env.RH_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  baseRpc: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  treasury: (process.env.NEXT_PUBLIC_TREASURY || "").toLowerCase(),
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmudyp5x100240ck2rd5rvkcd",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://synaps.chat",
  // wallets allowed to open /app/admin; defaults to the treasury wallet
  adminAddresses: (process.env.ADMIN_ADDRESSES || process.env.NEXT_PUBLIC_TREASURY || "")
    .split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
  // warn in the admin dashboard when OpenRouter credit drops below this
  lowCreditUsd: Number(process.env.LOW_CREDIT_USD ?? "5"),
};

export function missingEnv(): string[] {
  const out: string[] = [];
  if (!env.openrouterKey) out.push("OPENROUTER_API_KEY");
  if (!env.supabaseUrl) out.push("SUPABASE_URL");
  if (!env.supabaseServiceKey) out.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.sessionSecret) out.push("SESSION_SECRET");
  if (!env.treasury) out.push("NEXT_PUBLIC_TREASURY");
  return out;
}

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
  // extra credit for paying with $SYNAPS (0.1 = +10%), and the top-up size the bonus applies to
  synapsBonus: Math.max(0, Math.min(1, Number(process.env.SYNAPS_BONUS ?? "0.1"))),
  synapsBonusCapUsd: Number(process.env.SYNAPS_BONUS_CAP_USD ?? "500"),
  // referrals: share of the friend's FIRST top-up paid as credit to each side
  refReferrerPct: Number(process.env.REF_REFERRER_PCT ?? "0.1"),
  refRefereePct: Number(process.env.REF_REFEREE_PCT ?? "0.05"),
  refCapUsd: Number(process.env.REF_CAP_USD ?? "20"),
  refMinUsd: Number(process.env.REF_MIN_USD ?? "2"),
  // free tier: all free chat traffic together, per day (keeps us under OpenRouter's free-model cap)
  freeGlobalLimit: Number(process.env.FREE_GLOBAL_DAILY_LIMIT ?? "800"),
  // flat price per message with web search on (covers the search provider), USD
  webSearchFeeUsd: Number(process.env.WEB_SEARCH_FEE_USD ?? "0.02"),
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

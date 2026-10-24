import { createPublicClient, http, formatEther, formatUnits, erc20Abi } from "viem";
import { base } from "viem/chains";
import { getSessionAddress } from "@/lib/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ethUsd } from "@/lib/price";
import { robinhoodChain, USDC_BASE } from "@/lib/chains";
import { getToken, type TokenInfo } from "@/lib/token";
import { synapsUsd } from "@/lib/synaps-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Alert = { level: "critical" | "warning" | "info"; title: string; text: string };

/** OpenRouter account credit: what was bought, what was used, what's left. */
async function openrouter() {
  if (!env.openrouterKey) return { ok: false as const, error: "OPENROUTER_API_KEY is not set." };
  const headers = { Authorization: `Bearer ${env.openrouterKey}` };
  try {
    const [cr, kr] = await Promise.all([
      fetch("https://openrouter.ai/api/v1/credits", { headers, cache: "no-store" }),
      fetch("https://openrouter.ai/api/v1/key", { headers, cache: "no-store" }),
    ]);
    const credits = cr.ok ? (await cr.json())?.data : null;
    const key = kr.ok ? (await kr.json())?.data : null;
    if (!credits && !key) return { ok: false as const, error: `OpenRouter returned ${cr.status}.` };
    const total = Number(credits?.total_credits ?? NaN);
    const used = Number(credits?.total_usage ?? key?.usage ?? NaN);
    return {
      ok: true as const,
      total: Number.isFinite(total) ? total : null,
      used: Number.isFinite(used) ? used : null,
      remaining: Number.isFinite(total) && Number.isFinite(used) ? total - used : null,
      keyLimit: key?.limit ?? null,
      keyRemaining: key?.limit_remaining ?? null,
      freeTier: Boolean(key?.is_free_tier),
    };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Could not reach OpenRouter." };
  }
}

/** What's sitting in the treasury wallet, in USD, so the owner knows what can be moved to OpenRouter. */
async function treasury(token: TokenInfo | null) {
  if (!env.treasury) return null;
  const addr = env.treasury as `0x${string}`;
  const baseClient = createPublicClient({ chain: base, transport: http(env.baseRpc) });
  const rhClient = createPublicClient({ chain: robinhoodChain, transport: http(env.rhRpc) });
  const [price, ethBase, ethRh, usdc] = await Promise.all([
    ethUsd().catch(() => null),
    baseClient.getBalance({ address: addr }).catch(() => null),
    rhClient.getBalance({ address: addr }).catch(() => null),
    baseClient.readContract({ address: USDC_BASE as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [addr] }).catch(() => null),
  ]);
  const row = (label: string, amount: number | null, usd: number | null) => ({ label, amount, usd });
  const eb = ethBase == null ? null : Number(formatEther(ethBase));
  const er = ethRh == null ? null : Number(formatEther(ethRh));
  const uc = usdc == null ? null : Number(formatUnits(usdc as bigint, 6));
  const rows = [
    row("ETH · Robinhood Chain", er, er != null && price ? er * price : null),
    row("ETH · Base", eb, eb != null && price ? eb * price : null),
    row("USDC · Base", uc, uc),
  ];
  if (token) {
    const [bal, price] = await Promise.all([
      rhClient.readContract({ address: token.address as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [addr] }).catch(() => null),
      synapsUsd(token).catch(() => null),
    ]);
    const amt = bal == null ? null : Number(formatUnits(bal as bigint, token.decimals ?? 18));
    rows.push(row("$SYNAPS · Robinhood Chain", amt, amt != null && price ? amt * price.usd : null));
  }
  const total = rows.reduce((s, r) => s + (r.usd ?? 0), 0);
  return { address: env.treasury, ethUsd: price, rows, totalUsd: total };
}

export async function GET(req: Request) {
  const address = await getSessionAddress();
  if (!address || !env.adminAddresses.includes(address.toLowerCase())) {
    return Response.json({ error: { message: "Not found." } }, { status: 404 });
  }
  const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));

  const token = await getToken().catch(() => null);
  const [statsRes, or, tr] = await Promise.all([
    db().rpc("syn_admin_stats", { p_days: days }),
    openrouter(),
    treasury(token).catch(() => null),
  ]);
  if (statsRes.error) return Response.json({ error: { message: statsRes.error.message } }, { status: 500 });
  const stats = statsRes.data as any;

  // burn rate = what OpenRouter actually cost us per day over the last 7 days
  const burn7 = Number(stats?.usage?.d7?.cost ?? 0) / 1e6 / 7;
  const liability = Number(stats?.users?.balances_micros ?? 0) / 1e6;
  const alerts: Alert[] = [];

  if (!or.ok) {
    alerts.push({ level: "warning", title: "Can't read OpenRouter credit", text: or.error });
  } else if (or.remaining != null) {
    if (or.remaining <= 0.5) {
      alerts.push({ level: "critical", title: "OpenRouter credit is almost gone", text: `Only $${or.remaining.toFixed(2)} left. Paid models will start failing for users. Top up OpenRouter now.` });
    } else if (or.remaining < env.lowCreditUsd) {
      alerts.push({ level: "critical", title: "OpenRouter credit is low", text: `$${or.remaining.toFixed(2)} left, below your $${env.lowCreditUsd} alert level. Top up OpenRouter soon.` });
    }
    if (or.remaining < liability) {
      alerts.push({ level: "warning", title: "User balances exceed your OpenRouter credit", text: `Users hold $${liability.toFixed(2)} of prepaid credit but OpenRouter has $${or.remaining.toFixed(2)}. If they spend it all, requests will fail. Move funds from the treasury to OpenRouter.` });
    }
    if (burn7 > 0 && or.remaining / burn7 < 7) {
      alerts.push({ level: "warning", title: "Less than a week of credit left", text: `At the current pace ($${burn7.toFixed(2)}/day) OpenRouter credit lasts about ${Math.max(0, or.remaining / burn7).toFixed(1)} days.` });
    }
    if (or.total != null && or.total < 10) {
      alerts.push({ level: "info", title: "Free models are capped at 50 requests a day", text: "OpenRouter allows 1,000 free-model requests a day once your account has bought at least $10 of credit in total. Below that, all free users share 50 a day." });
    }
  }
  if (tr && tr.totalUsd > 20 && or.ok && or.remaining != null && or.remaining < tr.totalUsd * 0.25) {
    alerts.push({ level: "info", title: "Treasury has funds to move", text: `The treasury holds about $${tr.totalUsd.toFixed(2)}. Consider moving some to OpenRouter to keep a buffer.` });
  }

  return Response.json({
    days,
    generated_at: new Date().toISOString(),
    markup: env.markup,
    lowCreditUsd: env.lowCreditUsd,
    freeDailyLimit: env.freeDailyLimit,
    openrouter: or,
    treasury: tr,
    burnPerDay: burn7,
    token,
    alerts,
    stats,
  });
}

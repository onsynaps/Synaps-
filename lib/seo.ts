import { env } from "./env";
import type { Model } from "./models";

export const SITE = env.siteUrl.replace(/\/+$/, "");
export const DEFAULT_OG = { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: "Synaps — every AI model, one wallet" };
/** Social card with the Synaps logo for any page. */
export function ogCard(kicker: string, title: string, sub?: string) {
  const q = new URLSearchParams({ k: kicker, t: title, ...(sub ? { s: sub } : {}) });
  return { url: `/api/og?${q.toString()}`, width: 1200, height: 630, alt: title };
}
export const modelPath = (id: string) => "/models/" + id;
export const idFromSlug = (slug: string[]) => slug.map(decodeURIComponent).join("/");

export function ctxLabel(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(n || "—");
}

/** USD per 1M tokens, with the Synaps fee. */
export const per1M = (perToken: number) => perToken * 1_000_000;
export const money = (v: number) => (v === 0 ? "Free" : v < 0.01 ? "$" + v.toFixed(4) : v < 1 ? "$" + v.toFixed(3) : "$" + v.toFixed(2));

export function caps(m: Model) {
  const out: string[] = [];
  if (m.inputs.includes("image")) out.push("Reads images");
  if (m.inputs.includes("file")) out.push("Reads PDFs natively");
  if (m.outputs.includes("image")) out.push("Creates images");
  if (m.inputs.includes("audio")) out.push("Accepts audio");
  if (m.inputs.includes("video")) out.push("Accepts video");
  return out;
}

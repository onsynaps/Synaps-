import { env } from "./env";
import { clientIp } from "./http";

/** The free-tier counters a chat request is checked against: this visitor's IP, this browser, and everyone together. */
export function freeKeys(req: Request): { keys: string[]; limits: number[]; device: string | null } {
  const device = (req.headers.get("x-syn-device") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || null;
  const keys = [clientIp(req)];
  const limits = [env.freeDailyLimit];
  if (device) {
    keys.push("dev:" + device);
    limits.push(env.freeDailyLimit);
  }
  keys.push("global");
  limits.push(env.freeGlobalLimit);
  return { keys, limits, device };
}

/** True when the request comes from a page on this site (free chat is for the web app; scripts should use an API key). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).host;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    return o === host || o.replace(/^www\./, "") === host.replace(/^www\./, "");
  } catch {
    return false;
  }
}

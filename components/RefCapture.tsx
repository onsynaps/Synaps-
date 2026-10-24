"use client";
import { useEffect } from "react";

/** Remembers an invite code from ?ref=… for 30 days, so it is applied when the visitor signs in. First link wins. */
export function RefCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(location.search).get("ref")?.toLowerCase();
      if (!code || !/^[a-z0-9]{6,12}$/.test(code)) return;
      if (document.cookie.split("; ").some((c) => c.startsWith("syn_ref="))) return;
      document.cookie = `syn_ref=${code}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax; Secure`;
    } catch {}
  }, []);
  return null;
}

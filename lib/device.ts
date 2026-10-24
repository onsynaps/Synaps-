"use client";

/** A random id for this browser, used only to share the daily free-message allowance fairly. */
export function deviceId(): string {
  const KEY = "synaps.device";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-zA-Z0-9-]/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

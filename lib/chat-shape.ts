/** Shapes a chat for storage or sharing: keeps text, names and small thumbnails; drops file contents and generated images. */
export type StoredMsg = {
  role: "user" | "assistant";
  content: string;
  modelName?: string;
  charged?: number;
  tokens?: number;
  attachments?: { kind: "image" | "pdf" | "text"; name: string; size: number; thumb?: string }[];
  sources?: { url: string; title?: string }[];
  hadImages?: number;
};

const MAX_MSGS = 400;
const MAX_TEXT = 100_000;

export function slimMessages(input: unknown, keepThumbs = true): StoredMsg[] {
  if (!Array.isArray(input)) return [];
  const out: StoredMsg[] = [];
  for (const m of input.slice(-MAX_MSGS) as any[]) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const msg: StoredMsg = { role: m.role, content: String(m.content ?? "").slice(0, MAX_TEXT) };
    if (typeof m.modelName === "string") msg.modelName = m.modelName.slice(0, 80);
    if (Number.isFinite(m.charged)) msg.charged = Number(m.charged);
    if (Number.isFinite(m.tokens)) msg.tokens = Number(m.tokens);
    if (Array.isArray(m.attachments) && m.attachments.length) {
      msg.attachments = m.attachments.slice(0, 4).map((a: any) => ({
        kind: a?.kind === "image" || a?.kind === "pdf" ? a.kind : "text",
        name: String(a?.name ?? "file").slice(0, 120),
        size: Number(a?.size) || 0,
        ...(keepThumbs && typeof a?.thumb === "string" && a.thumb.startsWith("data:image/") && a.thumb.length < 40_000 ? { thumb: a.thumb } : {}),
      }));
    }
    if (Array.isArray(m.sources) && m.sources.length) {
      msg.sources = m.sources
        .filter((s: any) => typeof s?.url === "string" && /^https?:\/\//.test(s.url))
        .slice(0, 12)
        .map((s: any) => ({ url: s.url.slice(0, 500), title: typeof s.title === "string" ? s.title.slice(0, 200) : undefined }));
    }
    const imgs = Array.isArray(m.images) ? m.images.length : Number(m.hadImages) || 0;
    if (imgs) msg.hadImages = imgs;
    out.push(msg);
  }
  return out;
}

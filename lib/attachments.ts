"use client";

export type Attachment = {
  kind: "image" | "pdf" | "text";
  name: string;
  size: number;
  /** small preview for images, kept in saved history */
  thumb?: string;
  /** full data URL (images, PDFs); dropped when history is saved */
  data?: string;
  /** file contents for text documents; dropped when history is saved */
  text?: string;
};

export const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.html,.css,.js,.jsx,.ts,.tsx,.py,.sol,.rs,.go,.java,.c,.cpp,.h,.rb,.php,.sh,.sql,.toml,.ini,.env.example";

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|log|html?|css|jsx?|tsx?|py|sol|rs|go|java|c|cpp|h|rb|php|sh|sql|toml|ini|example)$/i;
export const MAX_FILES = 4;
const MAX_PDF = 3 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

function readAs(file: File, how: "dataURL" | "text"): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    if (how === "dataURL") r.readAsDataURL(file);
    else r.readAsText(file);
  });
}

/** Re-encodes an image so the longest side is at most `max` px. Keeps requests small. */
async function shrink(dataUrl: string, max: number, quality: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That image could not be opened."));
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function readAttachment(file: File): Promise<Attachment> {
  const name = file.name || "file";
  if (file.type.startsWith("image/")) {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${name} is larger than 20 MB.`);
    const raw = await readAs(file, "dataURL");
    const data = await shrink(raw, 1600, 0.85);
    const thumb = await shrink(raw, 160, 0.7);
    return { kind: "image", name, size: file.size, data, thumb };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(name)) {
    if (file.size > MAX_PDF) throw new Error(`${name} is larger than 3 MB. Try a smaller PDF or split it.`);
    const data = await readAs(file, "dataURL");
    return { kind: "pdf", name, size: file.size, data: data.replace(/^data:[^;]*;/, "data:application/pdf;") };
  }
  if (file.type.startsWith("text/") || TEXT_EXT.test(name) || file.type === "application/json") {
    let text = await readAs(file, "text");
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS) + "\n\n[truncated]";
    return { kind: "text", name, size: file.size, text };
  }
  throw new Error(`${name}: this file type is not supported. Use images, PDFs, or text and code files.`);
}

export function fmtSize(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

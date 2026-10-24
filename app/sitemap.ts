import type { MetadataRoute } from "next";
import { getModels } from "@/lib/models";
import { SITE, modelPath } from "@/lib/seo";

export const revalidate = 3600;

const DOCS = ["", "quickstart", "authentication", "chat-completions", "streaming", "tools", "models", "billing", "top-ups", "rate-limits", "errors", "privacy", "integrations", "faq"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const models = await getModels().catch(() => []);
  return [
    { url: SITE + "/", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: SITE + "/models", lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: SITE + "/app", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...models.map((m) => ({ url: SITE + modelPath(m.id), lastModified: now, changeFrequency: "weekly" as const, priority: m.free ? 0.6 : 0.7 })),
    ...DOCS.map((d) => ({ url: SITE + "/docs" + (d ? "/" + d : ""), lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: SITE + "/terms", lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: SITE + "/privacy", lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}

import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/og"], disallow: ["/api/", "/app/admin", "/app/wallet", "/app/keys"] }],
    sitemap: SITE + "/sitemap.xml",
    host: SITE,
  };
}

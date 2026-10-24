import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Synaps — Every AI model, one wallet",
    short_name: "Synaps",
    description: "Chat with Claude, GPT, Gemini, DeepSeek and more. Pay per message from your wallet.",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#06050a",
    theme_color: "#06050a",
    categories: ["productivity", "utilities", "developer"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New chat", url: "/app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Top up", url: "/app/wallet", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "API keys", url: "/app/keys", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

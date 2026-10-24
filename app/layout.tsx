import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { PwaRegister } from "@/components/Pwa";
import { env } from "@/lib/env";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "Synaps — Every AI model, one wallet", template: "%s · Synaps" },
  description: "Chat with or call Claude, GPT, Gemini, DeepSeek and more. Pay per message from your wallet. No subscription, no card.",
  openGraph: {
    title: "Synaps — Every AI model, one wallet",
    description: "Pay-per-message AI on Robinhood Chain. Top up from $1.",
    type: "website",
  },
  twitter: { card: "summary_large_image", site: "@onsynaps" },
  keywords: ["AI API", "pay with crypto", "Claude API", "GPT API", "Gemini API", "DeepSeek API", "OpenAI compatible", "Robinhood Chain", "Base", "USDC", "ETH", "pay per message"],
  applicationName: "Synaps",
  appleWebApp: { capable: true, title: "Synaps", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#06050a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${serif.variable}`}>
      <body>
        {children}
        <Analytics />
        <PwaRegister />
      </body>
    </html>
  );
}

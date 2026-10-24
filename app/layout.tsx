import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Synaps — Every AI model, one wallet", template: "%s · Synaps" },
  description: "Chat with or call Claude, GPT, Gemini, DeepSeek and more. Pay per message from your wallet. No subscription, no card.",
  openGraph: {
    title: "Synaps — Every AI model, one wallet",
    description: "Pay-per-message AI on Robinhood Chain. Top up from $1.",
    type: "website",
  },
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
      <body>{children}</body>
    </html>
  );
}

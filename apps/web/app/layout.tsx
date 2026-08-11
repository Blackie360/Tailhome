import type { Metadata } from "next";
import { DM_Mono, Inter, Manrope } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"], display: "swap" });

const siteUrl = "https://tailhome.blackielabs.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TailHome",
    template: "%s | TailHome"
  },
  description:
    "TailHome installs a private Tailscale homelab stack and ships a Go CLI for day-to-day service operations.",
  openGraph: {
    title: "TailHome",
    description:
      "A private homelab installer and Go CLI for Raspberry Pi OS, Debian, and Ubuntu.",
    url: siteUrl,
    siteName: "TailHome",
    images: [
      {
        url: "/images/tailhome-hero.png",
        width: 1536,
        height: 864,
        alt: "TailHome homelab control hub"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  alternates: {
    canonical: siteUrl
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}

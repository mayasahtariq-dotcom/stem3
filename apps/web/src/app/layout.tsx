import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Noto_Sans_Kannada, Rubik } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "700"], variable: "--font-deva", display: "swap" });
const kn = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["400", "700"], variable: "--font-kn", display: "swap" });

export const metadata: Metadata = {
  title: "Aaroh",
  description: "Bilingual science learning game for Classes 6 to 10, with phone-call lessons.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#58CC02", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={`${rubik.variable} ${deva.variable} ${kn.variable}`}>
      <body className="min-h-dvh"><Providers>{children}</Providers></body>
    </html>
  );
}

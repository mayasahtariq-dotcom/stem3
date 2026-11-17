import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Noto_Sans_Kannada, Rubik } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { AppProviders } from "./providers";
import "./globals.css";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["500", "700"], variable: "--font-devanagari", display: "swap" });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], weight: ["500", "700"], variable: "--font-kannada", display: "swap" });

export const metadata: Metadata = {
  title: "Aaroh",
  description: "Learn science on your own farm, in Hindi or Kannada with English.",
};

export const viewport: Viewport = { themeColor: "#58CC02", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${rubik.variable} ${devanagari.variable} ${kannada.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

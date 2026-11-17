import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import hi from "../messages/hi.json";
import kn from "../messages/kn.json";
import "../src/app/globals.css";

const MESSAGES = { hi: { ...hi, _en: en }, kn: { ...kn, _en: en } } as const;

/** Every story renders in Hindi and Kannada (toolbar switch); a11y checks run on each. */
const preview: Preview = {
  globalTypes: {
    locale: {
      description: "Regional language",
      toolbar: { icon: "globe", items: [{ value: "hi", title: "हिन्दी + English" }, { value: "kn", title: "ಕನ್ನಡ + English" }] },
    },
  },
  initialGlobals: { locale: "hi" },
  parameters: {
    layout: "centered",
    a11y: { test: "error" },
    backgrounds: { options: { cream: { name: "cream", value: "#FFF8EC" }, sky: { name: "sky", value: "#BFE8FB" } } },
  },
  decorators: [
    (Story, ctx) => {
      const locale = (ctx.globals.locale ?? "hi") as "hi" | "kn";
      return (
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Kolkata">
          <div lang={locale} style={{ fontFamily: "Rubik, 'Noto Sans Devanagari', 'Noto Sans Kannada', system-ui, sans-serif" }}>
            <Story />
          </div>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;

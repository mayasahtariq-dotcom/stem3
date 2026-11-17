import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom text sizes so `text-lg` and `text-ink` don't clash.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"] } },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

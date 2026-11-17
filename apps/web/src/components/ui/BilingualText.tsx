import { cn } from "@/lib/utils/cn";
import type { BilingualString } from "@/lib/i18n/use-bilingual";

export interface BilingualTextProps {
  text: BilingualString;
  /** Size of the regional line; the English line is one step smaller. */
  size?: "sm" | "base" | "lg" | "xl" | "2xl";
  align?: "left" | "center";
  /** Colour scheme: ink on light surfaces, white on coloured ones. */
  tone?: "default" | "inverse";
  as?: "p" | "span" | "h1" | "h2" | "h3" | "div";
  className?: string;
}

const SIZES = {
  sm: ["text-sm", "text-xs"],
  base: ["text-base", "text-sm"],
  lg: ["text-lg", "text-base"],
  xl: ["text-xl", "text-base"],
  "2xl": ["text-2xl", "text-lg"],
} as const;

/**
 * The bilingual rule: the bold regional (Hindi or Kannada) line above the muted
 * English line. Used for every question, option, button and explanation.
 */
export function BilingualText({ text, size = "base", align = "left", tone = "default", as: Tag = "p", className }: BilingualTextProps) {
  const [regional, english] = SIZES[size];
  const same = text.regional === text.english;
  return (
    <Tag className={cn("flex flex-col", align === "center" && "items-center text-center", className)}>
      <span className={cn("font-regional font-bold", regional, tone === "inverse" ? "text-white" : "text-ink")}>
        {text.regional}
      </span>
      {!same && (
        <span lang="en" className={cn("font-medium", english, tone === "inverse" ? "text-white/90" : "text-stone")}>
          {text.english}
        </span>
      )}
    </Tag>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Small rounded status label. */
export function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "info" }) {
  const tones = { plain: "bg-cloud text-ink", good: "bg-grass/20 text-ink", warn: "bg-coral/15 text-ink", info: "bg-sky-soft text-ink" };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

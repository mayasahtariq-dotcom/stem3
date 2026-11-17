import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface SpeechBubbleProps {
  children: ReactNode;
  /** Where the tail points: towards Golu below-left, or to the left. */
  tail?: "bottom" | "left";
  className?: string;
}

/** Golu's speech bubble. */
export function SpeechBubble({ children, tail = "bottom", className }: SpeechBubbleProps) {
  return (
    <div
      className={cn(
        "relative rounded-panel border-2 border-line bg-white px-5 py-4 shadow-float-1",
        tail === "bottom" &&
          "after:absolute after:-bottom-[13px] after:left-9 after:size-6 after:rotate-45 after:border-b-2 after:border-r-2 after:border-line after:bg-white",
        tail === "left" &&
          "after:absolute after:-left-[13px] after:top-6 after:size-6 after:rotate-45 after:border-b-2 after:border-l-2 after:border-line after:bg-white",
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

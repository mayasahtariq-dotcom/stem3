"use client";
import { useId } from "react";
import { cn } from "@/lib/utils/cn";
import { COW_POSES, COW_VIEWBOX, type CowPose } from "./art.generated";

export type { CowPose };

export interface GoluMascotProps {
  pose?: CowPose;
  size?: number;
  /** Gentle idle bob (disabled automatically under reduced motion). */
  animated?: boolean;
  label?: string;
  className?: string;
}

/** Golu the cow, static poses from the prototype. Growth and Lottie arrive in Phase 4. */
export function GoluMascot({ pose = "wave", size = 120, animated = true, label, className }: GoluMascotProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={(size * 248) / 228}
      viewBox={COW_VIEWBOX}
      overflow="visible"
      className={cn(animated && "golu-bob", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: COW_POSES[pose].replaceAll("__ID__", `g${id}`) }}
    />
  );
}

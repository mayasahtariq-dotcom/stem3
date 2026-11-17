import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Cream card on a soft lip: the default content surface. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div data-surface="card" className={cn("rounded-card border-2 border-line bg-cream p-5 shadow-[0_4px_0_var(--color-line)]", className)} {...rest} />;
}

/**
 * Wooden signboard panel for game UI floating over the 3D world: wood frame,
 * parchment face.
 */
export function WoodPanel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("wood-grain rounded-panel p-2 shadow-float-2 [box-shadow:0_6px_0_var(--color-wood-dark),var(--shadow-float-2)]", className)} {...rest}>
      <div className="rounded-card bg-parchment p-4 shadow-[var(--shadow-inset)]">{children}</div>
    </div>
  );
}

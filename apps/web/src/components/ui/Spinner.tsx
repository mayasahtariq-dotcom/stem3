import { cn } from "@/lib/utils/cn";

/** Small circular spinner (decorative; pair it with text or aria-busy). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-5 animate-spin rounded-full border-[3px] border-current border-r-transparent", className)}
    />
  );
}

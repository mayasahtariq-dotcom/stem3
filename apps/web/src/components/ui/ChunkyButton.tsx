"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

const button = cva(
  [
    "relative inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-button px-5 font-bold",
    "transition-[transform,box-shadow] duration-[var(--duration-instant)] ease-out",
    "disabled:cursor-not-allowed disabled:translate-y-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-grass-strong text-white [--lip-color:var(--color-grass-edge)] hover:brightness-110",
        white: "border-2 border-line bg-white text-ink [--lip-color:var(--color-line)] hover:bg-cream",
        ghost: "bg-transparent text-stone hover:bg-black/5",
        sky: "bg-sky-strong text-white [--lip-color:var(--color-sky-edge)] hover:brightness-110",
        wood: "wood-grain text-white [--lip-color:var(--color-wood-dark)] [text-shadow:0_1px_0_rgb(0_0_0/0.35)]",
      },
      size: {
        sm: "min-h-11 px-3 py-1.5 text-sm",
        md: "py-3 text-base",
        lg: "py-4 text-lg",
        icon: "size-11 p-0",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [
      { variant: ["primary", "white", "sky", "wood"], className: "lip active:translate-y-[var(--press)] active:shadow-[0_1px_0_var(--lip-color)]" },
      { variant: ["primary", "white", "sky", "wood"], className: "disabled:bg-line disabled:bg-none disabled:text-stone disabled:[--lip-color:#d6ccb8]" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  /** Shows a spinner and blocks clicks; the label stays for screen readers. */
  loading?: boolean;
  /** Render as the child element (e.g. a Next <Link>). */
  asChild?: boolean;
  children: ReactNode;
}

/** Chunky, tactile 3D button: a solid lip that the press pushes down. */
export function ChunkyButton({ variant, size, block, loading, asChild, className, disabled, children, ...rest }: ChunkyButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(button({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...(asChild ? {} : { type: rest.type ?? "button" })}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner className="absolute" />
          <span className="invisible inline-flex items-center gap-2">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

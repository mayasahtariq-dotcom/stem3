"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { BilingualText } from "./BilingualText";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label: BilingualString;
  /** Bilingual error; rendered in a live region and wired to aria-describedby. */
  error?: BilingualString | null;
  hint?: BilingualString;
  /** Fixed prefix inside the field, e.g. "+91". */
  prefix?: ReactNode;
  size?: "md" | "lg";
}

/** Labelled input with a bilingual label, hint and error. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, prefix, size = "lg", className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errId = `${inputId}-err`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId}>
        <BilingualText as="span" text={label} size="sm" />
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-card border-2 bg-white px-4 shadow-[var(--shadow-inset)] focus-within:border-sky-strong",
          error ? "border-coral-strong" : "border-line",
        )}
      >
        {prefix && <span className="font-bold text-stone">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint && hintId, error && errId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "min-h-12 w-full bg-transparent font-semibold text-ink outline-none placeholder:text-stone/70",
            size === "lg" ? "py-3 text-xl" : "py-2 text-base",
            className,
          )}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-stone">
          {hint.regional} · <span lang="en">{hint.english}</span>
        </p>
      )}
      <div aria-live="polite">
        {error && (
          <p id={errId} className="flex flex-col text-sm font-semibold text-coral-strong">
            <span>{error.regional}</span>
            <span lang="en" className="font-medium">
              {error.english}
            </span>
          </p>
        )}
      </div>
    </div>
  );
});

"use client";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";
import { BilingualText } from "./BilingualText";
import { StickerIcon } from "./StickerIcon";

export type AnswerState = "idle" | "selected" | "correct" | "incorrect";

export interface AnswerOptionProps {
  text: BilingualString;
  /** 1-4: shown as the keyboard shortcut badge. */
  index: number;
  state?: AnswerState;
  disabled?: boolean;
  /** Spoken state for screen readers, e.g. "Correct" / "Not quite". Never colour alone. */
  stateLabel?: string;
  onSelect?: () => void;
}

const STYLES: Record<AnswerState, string> = {
  idle: "border-line bg-white hover:bg-cream",
  selected: "border-sky-strong bg-sky-soft",
  correct: "border-grass-strong bg-[#ecf8e4]",
  incorrect: "border-coral-strong bg-[#fdeeed] motion-safe:animate-[shake_.35s_ease-in-out]",
};

/** A lesson answer card with idle, selected, correct and "Not quite" states. */
export function AnswerOption({ text, index, state = "idle", disabled, stateLabel, onSelect }: AnswerOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-card border-2 border-b-4 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] disabled:cursor-default",
        STYLES[state],
      )}
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-sm border-2 border-line bg-cream text-sm font-bold text-stone"
      >
        {index}
      </span>
      <BilingualText as="span" text={text} className="flex-1" />
      {state === "correct" && <StickerIcon name="star" size={26} />}
      {state === "incorrect" && <StickerIcon name="refresh" size={26} />}
      {stateLabel && <span className="sr-only">{stateLabel}</span>}
    </button>
  );
}

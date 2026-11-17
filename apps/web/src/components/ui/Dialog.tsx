"use client";
import * as RD from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { BilingualText } from "./BilingualText";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: BilingualString;
  description?: BilingualString;
  children?: ReactNode;
  /** Footer actions (ChunkyButtons). */
  actions?: ReactNode;
}

/** Accessible modal (Radix): focus trap, Escape to close, labelled title. */
export function Dialog({ open, onOpenChange, title, description, children, actions }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-[rgb(40_30_20/0.45)] motion-safe:animate-[fade-in_var(--duration-base)_ease-out]" />
        <RD.Content className="fixed left-1/2 top-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-panel border-2 border-line bg-cream p-6 shadow-float-2 motion-safe:animate-[pop-in_var(--duration-base)_var(--ease-spring)]">
          <RD.Title>
            <BilingualText as="span" text={title} size="xl" />
          </RD.Title>
          {description ? (
            <RD.Description asChild>
              <div>
                <BilingualText as="span" text={description} size="sm" />
              </div>
            </RD.Description>
          ) : (
            <RD.Description className="sr-only">{title.english}</RD.Description>
          )}
          {children}
          {actions && <div className="flex flex-col gap-3 pt-2">{actions}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

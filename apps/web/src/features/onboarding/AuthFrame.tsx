"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { BilingualText, GoluMascot, MeadowScene, SpeechBubble, StickerIcon, type CowPose } from "@/components/ui";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";

export interface AuthFrameProps {
  title: BilingualString;
  subtitle?: BilingualString;
  golu?: { pose: CowPose; says: BilingualString };
  backHref?: string;
  children: ReactNode;
}

/** Welcoming frame for onboarding and login: meadow, Golu, and a cream card. */
export function AuthFrame({ title, subtitle, golu, backHref, children }: AuthFrameProps) {
  const c = useBilingual("common");
  return (
    <MeadowScene>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pb-10 pt-6">
        <div className="flex min-h-11 items-center">
          {backHref && (
            <Link href={backHref} className="inline-flex min-h-11 items-center gap-1 rounded-button px-2 font-bold text-ink hover:bg-white/60">
              <StickerIcon name="repeat" size={20} />
              <span>{c("back").regional}</span>
              <span lang="en" className="sr-only">
                {c("back").english}
              </span>
            </Link>
          )}
        </div>
        {golu && (
          <div className="flex items-end gap-3">
            <GoluMascot pose={golu.pose} size={92} />
            <SpeechBubble tail="left" className="mb-6 flex-1">
              <BilingualText text={golu.says} size="sm" />
            </SpeechBubble>
          </div>
        )}
        <section className="flex flex-col gap-5 rounded-panel border-2 border-line bg-cream/95 p-5 shadow-float-2 backdrop-blur-sm">
          <header className="flex flex-col gap-1">
            <BilingualText as="h1" text={title} size="2xl" />
            {subtitle && <BilingualText text={subtitle} size="sm" />}
          </header>
          {children}
        </section>
      </main>
    </MeadowScene>
  );
}

/** Large selectable card used by the language and role pickers. */
export function ChoiceCard({ text, hint, icon, onClick, selected }: { text: BilingualString; hint?: BilingualString; icon?: ReactNode; onClick: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-4 rounded-card border-2 border-b-4 px-4 py-3 text-left transition-colors ${selected ? "border-sky-strong bg-sky-soft" : "border-line bg-white hover:bg-cream"}`}
    >
      {icon}
      <span className="flex flex-col">
        <BilingualText as="span" text={text} size="lg" />
        {hint && <span className="text-sm text-stone">{hint.regional}</span>}
      </span>
    </button>
  );
}

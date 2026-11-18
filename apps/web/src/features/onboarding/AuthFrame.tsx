"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChunkyTitle, Sparkles } from "@/components/playful";
import { BilingualText, GoluMascot, SpeechBubble, StickerIcon, type CowPose } from "@/components/ui";
import { useBilingual, type BilingualString } from "@/lib/i18n/use-bilingual";

export interface AuthFrameProps {
  title: BilingualString;
  subtitle?: BilingualString;
  golu?: { pose: CowPose; says: BilingualString };
  backHref?: string;
  children: ReactNode;
}

/** Welcoming frame for onboarding and login: sunburst, a chunky "learn through play" headline, Golu, a white card. */
export function AuthFrame({ title, subtitle, golu, backHref, children }: AuthFrameProps) {
  const c = useBilingual("common");
  return (
    <div className="playful sunburst relative isolate min-h-dvh overflow-hidden">
      <Sparkles />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        <div className="flex min-h-11 items-center">
          {backHref && (
            <Link href={backHref} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/70 px-3 font-bold text-ink hover:bg-white">
              <StickerIcon name="repeat" size={20} />
              <span>{c("back").regional}</span>
              <span lang="en" className="sr-only">
                {c("back").english}
              </span>
            </Link>
          )}
        </div>
        <div className="flex items-end gap-2">
          <ChunkyTitle text={c("tagline")} as="p" className="flex-1" />
          {golu && (
            <div className="float-soft shrink-0">
              <GoluMascot pose={golu.pose} size={112} />
            </div>
          )}
        </div>
        {golu && (
          <SpeechBubble tail="left" className="self-start">
            <BilingualText text={golu.says} size="sm" />
          </SpeechBubble>
        )}
        <section className="flex flex-col gap-5 rounded-[28px] bg-white p-5 shadow-[0_16px_40px_rgb(20_70_160/0.22)]">
          <header className="flex flex-col gap-1">
            <BilingualText as="h1" text={title} size="2xl" />
            {subtitle && <BilingualText text={subtitle} size="sm" />}
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}

/** Large selectable card used by the language and role pickers. */
export function ChoiceCard({ text, hint, icon, onClick, selected }: { text: BilingualString; hint?: BilingualString; icon?: ReactNode; onClick: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-4 rounded-3xl border-2 px-4 py-3 text-left transition-transform hover:-translate-y-0.5 ${selected ? "border-[#2f8cf0] bg-[#e8f3ff] shadow-[0_6px_0_#8ec5ff]" : "border-[#d7e6f7] bg-white shadow-[0_6px_0_#d7e6f7] hover:bg-[#f5f9ff]"}`}
    >
      {icon}
      <span className="flex flex-col">
        <BilingualText as="span" text={text} size="lg" />
        {hint && <span className="text-sm text-stone">{hint.regional}</span>}
      </span>
    </button>
  );
}

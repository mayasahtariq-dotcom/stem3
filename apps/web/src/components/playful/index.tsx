"use client";
import type { ReactNode } from "react";
import { GoluMascot, StickerIcon, type CowPose, type StickerIconName } from "@/components/ui";
import type { BilingualString } from "@/lib/i18n/use-bilingual";
import { cn } from "@/lib/utils/cn";

/*
 * Playful look for the sign-in, teacher and parent modes (warm sunburst, lavender, chunky headlines,
 * a big Golu, pastel tiles). The student farm and game have their own look and never use these.
 */
export type PlayTone = "sun" | "lavender";

/** Four-point sparkles, like the streak screen. Decorative only. */
export function Sparkles({ className, light = true }: { className?: string; light?: boolean }) {
  const spots = [
    { x: "8%", y: "14%", s: 22, d: "0s" },
    { x: "86%", y: "10%", s: 28, d: ".6s" },
    { x: "78%", y: "62%", s: 18, d: "1.2s" },
    { x: "14%", y: "72%", s: 16, d: "1.8s" },
    { x: "50%", y: "6%", s: 14, d: ".9s" },
  ];
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {spots.map((p, i) => (
        <svg key={i} viewBox="0 0 24 24" width={p.s} height={p.s} className="twinkle absolute" style={{ left: p.x, top: p.y, animationDelay: p.d }}>
          <path d="M12 0c.8 6.4 4.8 10.6 12 12-7.2 1.4-11.2 5.6-12 12-.8-6.4-4.8-10.6-12-12C7.2 10.6 11.2 6.4 12 0Z" fill={light ? "#fff" : "#ffcf4a"} />
        </svg>
      ))}
    </span>
  );
}

/** Page background for a playful mode. */
export function PlayfulPage({ tone, className, children }: { tone: PlayTone; className?: string; children: ReactNode }) {
  const blobs = tone === "sun"
    ? [["#7cc4ff", "8%", "10%", "34rem"], ["#a78bfa", "70%", "4%", "28rem"], ["#5eead4", "60%", "62%", "30rem"]]
    : [["#c4b5fd", "6%", "12%", "32rem"], ["#93c5fd", "68%", "8%", "28rem"], ["#f9a8d4", "40%", "66%", "26rem"]];
  return (
    <div className={cn("playful relative min-h-dvh", tone === "sun" ? "playful-sun-page" : "playful-lavender playful-lavender-page", className)}>
      <div aria-hidden className="blob-field">
        {blobs.map(([c, x, y, s], i) => (
          <span key={i} className="blob" style={{ background: c, left: x, top: y, width: s, height: s, animationDelay: `${i * -6}s` }} />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** A chunky two-language headline: bold regional line, then the English line in the display face. */
export function ChunkyTitle({ text, as: Tag = "h1", inverse = true, size = "xl", className }: { text: BilingualString; as?: "h1" | "h2" | "p"; inverse?: boolean; size?: "lg" | "xl"; className?: string }) {
  const same = text.regional === text.english;
  return (
    <Tag className={cn("flex flex-col", className)}>
      <span className={cn("font-regional font-extrabold leading-tight", size === "xl" ? "text-3xl tablet:text-4xl" : "text-2xl", inverse ? "text-white [text-shadow:0_2px_0_rgb(0_0_0/0.12)]" : "text-ink")}>{text.regional}</span>
      {!same && (
        <span lang="en" className={cn("font-display uppercase leading-none", size === "xl" ? "text-4xl tablet:text-5xl" : "text-2xl", inverse ? "text-[#0b2a5c]/80" : "text-[#1d6fe0]")}>
          {text.english}
        </span>
      )}
    </Tag>
  );
}

/** Big rounded hero with sunburst rays, a chunky headline and Golu. */
export function Hero({ tone = "sun", eyebrow, title, subtitle, pose = "wave", action, children, className, titleAs = "h1" }: {
  titleAs?: "h1" | "h2" | "p"; tone?: PlayTone; eyebrow?: BilingualString; title: BilingualString; subtitle?: BilingualString; pose?: CowPose;
  action?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden rounded-[28px] p-5 tablet:p-7", tone === "sun" ? "sunburst" : "lavender-burst", className)} data-testid="hero">
      <span aria-hidden className="hero-shine" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/20 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-white/10 blur-3xl" />
      <Sparkles />
      <div className="relative flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {eyebrow && (
            <span className="self-start rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink">
              {eyebrow.regional} · <span lang="en">{eyebrow.english}</span>
            </span>
          )}
          <ChunkyTitle text={title} as={titleAs} />
          {subtitle && (
            <p className="flex flex-col text-sm font-semibold text-[#0b2a5c]/85">
              <span className="font-regional">{subtitle.regional}</span>
              {subtitle.english !== subtitle.regional && <span lang="en" className="text-xs opacity-80">{subtitle.english}</span>}
            </p>
          )}
          {children}
          {action && <div className="mt-1">{action}</div>}
        </div>
        <div className="relative hidden shrink-0 tablet:block">
          <div className="float-soft">
            <GoluMascot pose={pose} size={150} />
          </div>
          <span aria-hidden className="mx-auto mt-1 block h-3 w-24 rounded-full bg-black/10" />
        </div>
        <div className="shrink-0 tablet:hidden">
          <GoluMascot pose={pose} size={88} />
        </div>
      </div>
    </section>
  );
}

export const PASTELS = {
  blue: { bg: "bg-[#dcefff]", ring: "bg-[#2f8cf0]", text: "text-[#0d4f9e]" },
  lavender: { bg: "bg-[#ece6ff]", ring: "bg-[#7c5cff]", text: "text-[#4b2fc4]" },
  sky: { bg: "bg-[#dff0ff]", ring: "bg-[#1c8fe0]", text: "text-[#0a5a99]" },
  lemon: { bg: "bg-[#fff3c4]", ring: "bg-[#f2b500]", text: "text-[#8a6400]" },
  mint: { bg: "bg-[#ddf7e3]", ring: "bg-[#2fa65a]", text: "text-[#17663a]" },
  rose: { bg: "bg-[#ffe1e4]", ring: "bg-[#f0566b]", text: "text-[#a8172c]" },
} as const;
export type Pastel = keyof typeof PASTELS;

/** A sticker in a soft coloured circle. */
export function IconBubble({ icon, pastel = "blue", size = 44 }: { icon: StickerIconName; pastel?: Pastel; size?: number }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", PASTELS[pastel].bg)} style={{ width: size + 16, height: size + 16 }}>
      <StickerIcon name={icon} size={size} />
    </span>
  );
}

/** Stat tile like "6 Day streak": icon bubble, big number, label. */
export function PlayStat({ icon, value, label, pastel = "blue", warn = false }: { icon: StickerIconName; value: string; label: BilingualString; pastel?: Pastel; warn?: boolean }) {
  return (
    <div className={cn("play-stat glass flex flex-col items-center gap-1 rounded-3xl p-4 text-center", warn && "ring-2 ring-[#f0566b]")}>
      <IconBubble icon={icon} pastel={warn ? "rose" : pastel} size={30} />
      <span className="text-2xl font-extrabold tabular-nums text-ink">{value}</span>
      <span className="flex flex-col text-xs leading-tight">
        <span className="font-regional font-bold text-ink">{label.regional}</span>
        {label.english !== label.regional && <span lang="en" className="text-stone">{label.english}</span>}
      </span>
    </div>
  );
}

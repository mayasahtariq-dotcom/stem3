"use client";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { speak } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/* ChunkyButton: primary (grass), white, ghost, sky, coral. 12px radius, pressed 3D lip. */
type Variant = "primary" | "white" | "ghost" | "sky" | "coral";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-grass text-white shadow-[0_4px_0_var(--color-grass-dark)] hover:brightness-105",
  sky: "bg-sky text-white shadow-[0_4px_0_var(--color-sky-dark)] hover:brightness-105",
  coral: "bg-coral text-white shadow-[0_4px_0_#D33131] hover:brightness-105",
  white: "bg-white text-ink border-2 border-line shadow-[0_4px_0_var(--color-line)]",
  ghost: "bg-transparent text-sky border-2 border-transparent hover:bg-sky/10",
};
export function ChunkyButton({ variant = "primary", className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button {...rest} className={clsx(
      "min-h-11 rounded-[12px] px-5 py-3 font-bold uppercase tracking-wide transition active:translate-y-[3px] active:shadow-none",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
      VARIANTS[variant], className)}>{children}</button>
  );
}

/* BilingualText: bold regional line above a muted English line. */
export function BilingualText({ regional, english, className, as: Tag = "div", size = "md" }:
  { regional: ReactNode; english?: ReactNode; className?: string; as?: "div" | "h1" | "h2" | "h3" | "p"; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: ["text-sm", "text-xs"], md: ["text-base", "text-sm"], lg: ["text-xl", "text-sm"], xl: ["text-3xl", "text-base"] }[size];
  return (
    <Tag className={clsx("leading-snug", className)}>
      <span className={clsx("block font-bold", sizes[0])}>{regional}</span>
      {english ? <span className={clsx("block text-muted", sizes[1])}>{english}</span> : null}
    </Tag>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-[16px] border-2 border-line bg-white p-4", className)}>{children}</div>;
}

export function ProgressBar({ value, max, color = "bg-grass", label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="h-4 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0}
         aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <motion.div className={clsx("h-full rounded-full", color)} initial={false} animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}

export function SpeechBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative rounded-[16px] border-2 border-line bg-white px-4 py-3", className)}>
      {children}
      <span aria-hidden className="absolute -left-2 top-5 h-4 w-4 rotate-45 border-b-2 border-l-2 border-line bg-white" />
    </div>
  );
}

export function SourceChip({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-3 py-1 text-xs font-bold text-sky-dark">
    <StickerIcon name="book" size={14} />{label}</span>;
}

export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const lang = useSession((s) => s.lang);
  return (
    <button type="button" onClick={() => speak(text, lang)} aria-label={label}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[12px] border-2 border-line bg-white px-3 font-bold text-sky">
      <StickerIcon name="speaker" size={20} /><span className="ml-1 hidden sm:inline">{label}</span>
    </button>
  );
}

/* Loading / empty / error states, used by every screen. */
export function QueryState({ loading, error, empty, emptyText, children, onRetry }:
  { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: string; children: ReactNode; onRetry?: () => void }) {
  if (loading) return <div className="flex items-center justify-center p-10" role="status" aria-live="polite">
    <span className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-grass" /><span className="sr-only">Loading</span></div>;
  if (error) return <Card className="border-coral/40 bg-coral/5 text-center">
    <p className="font-bold text-coral">{error instanceof Error ? error.message : "Something went wrong"}</p>
    {onRetry ? <ChunkyButton variant="white" className="mt-3" onClick={onRetry}>Try again</ChunkyButton> : null}</Card>;
  if (empty) return <Card className="text-center text-muted">{emptyText ?? "Nothing here yet."}</Card>;
  return <>{children}</>;
}

/* Illustrated sticker icons (inline SVG, never emoji). */
export function StickerIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const s = { width: size, height: size, viewBox: "0 0 32 32", className, "aria-hidden": true } as const;
  switch (name) {
    case "flame": return <svg {...s}><path d="M16 3c2 5 8 8 8 15a8 8 0 0 1-16 0c0-4 2-6 3-8 1 3 3 4 3 4-1-5 1-8 2-11z" fill="#FF9600" stroke="#fff" strokeWidth="2"/><path d="M16 15c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8z" fill="#FFC800"/></svg>;
    case "heart": return <svg {...s}><path d="M16 28S4 20 4 11a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 9-12 17-12 17z" fill="#FF4B4B" stroke="#fff" strokeWidth="2"/><ellipse cx="11" cy="11" rx="2.5" ry="1.5" fill="#fff" opacity=".6"/></svg>;
    case "gem": return <svg {...s}><path d="M8 5h16l5 7-13 16L3 12z" fill="#1CB0F6" stroke="#fff" strokeWidth="2"/><path d="M8 5l8 7 8-7M3 12h26M16 12v16" stroke="#fff" strokeWidth="1.5" opacity=".7"/></svg>;
    case "star": return <svg {...s}><path d="M16 3l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#FFC800" stroke="#fff" strokeWidth="2"/></svg>;
    case "trophy": return <svg {...s}><path d="M9 4h14v7a7 7 0 0 1-14 0zM5 6h4v4a4 4 0 0 1-4-4zM27 6h-4v4a4 4 0 0 0 4-4zM13 18h6v4h3v5H10v-5h3z" fill="#FFC800" stroke="#fff" strokeWidth="2"/></svg>;
    case "book": return <svg {...s}><path d="M4 6c4-2 8-2 12 1 4-3 8-3 12-1v20c-4-2-8-2-12 1-4-3-8-3-12-1z" fill="#1CB0F6" stroke="#fff" strokeWidth="2"/><path d="M16 7v20" stroke="#fff" strokeWidth="2"/></svg>;
    case "speaker": return <svg {...s}><path d="M5 12h5l7-6v20l-7-6H5z" fill="#1CB0F6"/><path d="M21 11a6 6 0 0 1 0 10M24 8a10 10 0 0 1 0 16" stroke="#1CB0F6" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
    case "learn": return <svg {...s}><path d="M3 13l13-7 13 7-13 7z" fill="#58CC02" stroke="#fff" strokeWidth="2"/><path d="M8 16v6c4 3 12 3 16 0v-6" fill="#46A302"/></svg>;
    case "quest": return <svg {...s}><rect x="6" y="4" width="20" height="24" rx="4" fill="#CE82FF" stroke="#fff" strokeWidth="2"/><path d="M11 12l2 2 4-4M11 20h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>;
    case "league": return <svg {...s}><path d="M6 6h20v8c0 7-5 11-10 13-5-2-10-6-10-13z" fill="#1CB0F6" stroke="#fff" strokeWidth="2"/><path d="M16 10l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="#FFC800"/></svg>;
    case "profile": return <svg {...s}><circle cx="16" cy="11" r="6" fill="#FF9600" stroke="#fff" strokeWidth="2"/><path d="M5 28c1-6 6-9 11-9s10 3 11 9z" fill="#FF9600" stroke="#fff" strokeWidth="2"/></svg>;
    case "pot": return <svg {...s}><path d="M7 12h18l-2 14H9z" fill="#C9772B" stroke="#fff" strokeWidth="2"/><rect x="5" y="9" width="22" height="4" rx="2" fill="#E8913C"/><circle cx="16" cy="18" r="3" fill="#FFC800"/></svg>;
    case "phone": return <svg {...s}><rect x="9" y="3" width="14" height="26" rx="3" fill="#3C3C3C" stroke="#fff" strokeWidth="2"/><rect x="11" y="6" width="10" height="17" rx="1" fill="#1CB0F6"/><circle cx="16" cy="26" r="1.2" fill="#fff"/></svg>;
    case "lock": return <svg {...s}><rect x="7" y="14" width="18" height="13" rx="3" fill="#AFAFAF"/><path d="M11 14v-3a5 5 0 0 1 10 0v3" stroke="#AFAFAF" strokeWidth="3" fill="none"/></svg>;
    case "check": return <svg {...s}><circle cx="16" cy="16" r="13" fill="#58CC02" stroke="#fff" strokeWidth="2"/><path d="M10 16l4 4 8-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>;
    case "video": return <svg {...s}><rect x="3" y="7" width="20" height="18" rx="4" fill="#FF4B4B"/><path d="M23 13l6-4v14l-6-4z" fill="#FF4B4B"/><path d="M11 12l6 4-6 4z" fill="#fff"/></svg>;
    case "reading": return <svg {...s}><path d="M4 6c4-2 8-2 12 1 4-3 8-3 12-1v20c-4-2-8-2-12 1-4-3-8-3-12-1z" fill="#CE82FF" stroke="#fff" strokeWidth="2"/></svg>;
    case "interactive": return <svg {...s}><rect x="4" y="4" width="10" height="10" rx="3" fill="#FF9600"/><rect x="18" y="18" width="10" height="10" rx="3" fill="#1CB0F6"/><path d="M14 9h6a3 3 0 0 1 3 3v6" stroke="#3C3C3C" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
    case "quiz": return <svg {...s}><circle cx="16" cy="16" r="13" fill="#58CC02" stroke="#fff" strokeWidth="2"/><path d="M12 12a4 4 0 1 1 6 3c-1.5 1-2 2-2 3.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/><circle cx="16" cy="23" r="1.8" fill="#fff"/></svg>;
    default: return <svg {...s}><circle cx="16" cy="16" r="12" fill="#E5E5E5"/></svg>;
  }
}
